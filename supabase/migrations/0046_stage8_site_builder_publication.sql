-- Website Builder Faz 10 — published snapshot storage + atomic publish/rollback.
--
-- Tasarim karari: builder icin AYRI sayfa/section snapshot tablolari yerine
-- tek bir JSONB snapshot tablosu (mevcut draft modeliyle birebir tutarli,
-- draft zaten tek bir JSONB document olarak saklaniyor). Snapshot immutable
-- kabul edilir: hicbir UPDATE/DELETE yolu yoktur, bu yuzden updated_at veya
-- touch_updated_at trigger'i eklenmez.
--
-- Bu tablo, mevcut business_publication_revisions ledger'ina "source='builder'"
-- ile entegre olur (ayni version sayaci paylasilir) ANCAK builder revision'lari
-- HICBIR ZAMAN status='published' almaz (status='preview' kullanilir). Bunun
-- nedeni: lib/publishing.ts'teki readLatestPublishedRevision() legacy public
-- site render kaynagi icin "status='published' olan en son revision"i arar ve
-- o revision_id'ye karsilik gelen business_publication_businesses/profiles/...
-- satirlarini okur. Builder bu satirlari YAZMAZ (asagida aciklaniyor), bu
-- yuzden builder revision'i status='published' alsaydi legacy public site
-- okumasi o revision icin hicbir panel snapshot'i bulamaz ve public site
-- ANINDA bozulurdu. status='preview' kullanmak bu collision'i miras kodu
-- HIC DEGISTIRMEDEN, sifir riskle onler; builder revision'lari yine de ayni
-- ledger'da (history listing'de) gorunur durumda kalir.
--
-- Ayni nedenle bu migration mevcut business_publication_* (businesses,
-- profiles, services, vehicles, routes, blog_posts, seo, locales, translations)
-- tablolarina HICBIR YAZMA EKLEMEZ: o tablolar BusinessPanelData semasini
-- tasir, builder'in WorkspaceSnapshot semasi tamamen farklidir — ikisini
-- karistirmak legacy public site icerigini bozardi. Public site render
-- kaynagi bu fazda degismiyor.
create table if not exists public.business_publication_site_builder_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  revision_id uuid not null,
  document jsonb not null,
  document_version integer not null,
  created_at timestamptz not null default now()
);

create index if not exists business_publication_site_builder_documents_business_id_idx
  on public.business_publication_site_builder_documents (business_id, created_at desc);

create index if not exists business_publication_site_builder_documents_version_idx
  on public.business_publication_site_builder_documents (business_id, document_version desc);

do $$
begin
  begin
    alter table public.business_publication_site_builder_documents
      add constraint business_publication_site_builder_documents_version_check
      check (document_version > 0);
  exception
    when duplicate_object then null;
  end;

  begin
    alter table public.business_publication_site_builder_documents
      add constraint business_publication_site_builder_documents_business_revision_key
      unique (business_id, revision_id);
  exception
    -- Bu isim 63 byte Postgres sinirini astigi icin kesiliyor; kesilen isim
    -- zaten varsa Postgres bunu duplicate_object degil duplicate_table olarak
    -- raporluyor (constraint'in kendisi degil, ona ait implicit index icin).
    when duplicate_object or duplicate_table then null;
  end;

  -- Composite FK'yi mevcut business_publication_* tablolarindaki desenle
  -- ayni sekilde kuruyoruz: (business_id, revision_id) -> revisions(business_id, id).
  -- NOT VALID + sonradan validate: mevcut satir olmadigi icin (yeni tablo)
  -- pratikte fark etmez, ama proje deseniyle tutarli kaliyoruz.
  begin
    alter table public.business_publication_site_builder_documents
      add constraint business_publication_site_builder_documents_business_revision_fk
      foreign key (business_id, revision_id)
      references public.business_publication_revisions (business_id, id)
      on delete cascade
      not valid;
  exception
    when duplicate_object or duplicate_table then null;
  end;
end;
$$;

alter table public.business_publication_site_builder_documents
  validate constraint business_publication_site_builder_documents_business_revision_fk;

do $$
begin
  perform public.apply_uuid_tenant_rls('public.business_publication_site_builder_documents'::regclass);
end;
$$;

-- ============================================================
-- Atomik publish: draft dogrulama + revision + snapshot + draft baseline
-- guncellemesi TEK transaction icinde (tek plpgsql cagrisi = tek transaction).
-- Ayri REST cagrilariyla (SELECT sonra INSERT sonra UPDATE, Promise.all ile)
-- yapilirsa kismi yazim (yarim revision) riski olusur; bu fonksiyon o riski
-- ortadan kaldirir.
--
-- Yetki: yalnizca service_role calistirabilir (asagida REVOKE/GRANT).
-- anon/authenticated bu RPC'yi PostgREST uzerinden asla cagiramaz.
-- ============================================================
create or replace function public.publish_builder_draft(
  p_business_id uuid,
  p_expected_draft_version integer,
  p_expected_published_version integer,
  p_note text default 'Yayınlandı'
)
returns table (
  revision_id uuid,
  published_version integer,
  draft_version integer,
  published_at timestamptz
)
language plpgsql
as $$
declare
  v_draft public.business_site_builder_drafts%rowtype;
  v_ledger_version integer;
  v_next_published_version integer;
  v_revision_id uuid;
  v_now timestamptz := now();
begin
  if p_business_id is null then
    raise exception 'business_id_required';
  end if;

  -- Draft satirini kilitle: bu satir uzerinde ayni anda calisan baska bir
  -- publish veya save, bu transaction commit/rollback olana kadar bekler.
  select *
    into v_draft
    from public.business_site_builder_drafts
    where business_id = p_business_id
    for update;

  if not found then
    raise exception 'draft_not_found';
  end if;

  if v_draft.draft_version is distinct from p_expected_draft_version then
    raise exception 'draft_conflict' using
      detail = json_build_object(
        'currentDraftVersion', v_draft.draft_version,
        'currentPublishedVersion', v_draft.base_published_version
      )::text;
  end if;

  if v_draft.base_published_version is distinct from p_expected_published_version then
    raise exception 'published_conflict' using
      detail = json_build_object(
        'currentDraftVersion', v_draft.draft_version,
        'currentPublishedVersion', v_draft.base_published_version
      )::text;
  end if;

  -- v_next_published_version: builder'a OZEL, kesinlikle monoton sayac
  -- (base_published_version + 1). Bunu business_publication_revisions'in
  -- paylasilan ledger version'undan (v_ledger_version) BILEREK ayri tutuyoruz:
  -- ledger version 0'dan baslar ve bos bir tabloda ilk deger 1'dir — bu da
  -- draft'in "hicbir sey yayinlanmadi" varsayilan degeri olan 1 ile CAKISIR.
  -- Iki paralel ilk-publish denemesi ayni "beklenen published version = 1"
  -- ile gelir; eger next_published_version de ledger'dan turetilseydi ikisi
  -- de ayni degeri gorur ve HER IKISI DE basariyla "1" olarak yayinlanirdi
  -- (optimistic lock'u sessizce atlar). base_published_version + 1 kullanmak
  -- bunu imkansiz kilar: ilk publish 1 -> 2 yapar, ikinci paralel deneme artik
  -- "expected=1" ile eslesmeyen "current=2" gorur ve published_conflict alir.
  --
  -- Faz 13 duzeltmesi: rollback_builder_publication draft'a HICBIR sekilde
  -- dokunmadan (base_published_version guncellenmeden) document_version'i
  -- ileri tasiyabilir (bkz. asagidaki fonksiyon). Bu durumda tek basina
  -- "base_published_version + 1" kullanmak, rollback'in zaten olusturdugu
  -- bir document_version ile CAKISABILIRDI (ayni business icin iki farkli
  -- satirin ayni document_version'a sahip olmasi). greatest(...) ile her
  -- zaman mevcut en yuksek document_version'in da onunde kalmasi garanti
  -- edilir — rollback hic yasanmadiysa iki taraf zaten esittir, davranis
  -- degismez.
  select greatest(
    v_draft.base_published_version + 1,
    coalesce((
      select max(document_version) + 1
      from public.business_publication_site_builder_documents
      where business_id = p_business_id
    ), 1)
  ) into v_next_published_version;

  select coalesce(max(version), 0) + 1
    into v_ledger_version
    from public.business_publication_revisions
    where business_id = p_business_id;

  insert into public.business_publication_revisions (
    id, business_id, version, status, source, note, created_at, published_at
  ) values (
    gen_random_uuid(), p_business_id, v_ledger_version, 'preview', 'builder', coalesce(p_note, 'Yayınlandı'), v_now, v_now
  )
  returning id into v_revision_id;

  insert into public.business_publication_site_builder_documents (
    id, business_id, revision_id, document, document_version, created_at
  ) values (
    gen_random_uuid(), p_business_id, v_revision_id, v_draft.document, v_next_published_version, v_now
  );

  update public.business_site_builder_drafts
    set base_published_version = v_next_published_version
    where id = v_draft.id;

  return query select v_revision_id, v_next_published_version, v_draft.draft_version, v_now;
end;
$$;

-- ============================================================
-- Rollback hazirligi: eski bir builder snapshot'ini YENI bir revision olarak
-- kopyalar (mevcut satirlari mutate etmez, immutable snapshot ilkesi korunur).
-- Draft tablosuna HICBIR YAZMA yapmaz — draft otomatik degismez.
--
-- Faz 13 SON DUZELTME — race condition kapatildi: bu fonksiyon onceden
-- document_version'i hicbir kilit almadan "select max(document_version)+1"
-- ile hesapliyordu. Iki paralel rollback (veya bir rollback + bir ayni-anda
-- calisan publish_builder_draft) bu SELECT'i ayni anda, birbirinin henuz
-- commit etmedigi bir sirada calistirabilir ve İKİSİ DE AYNI document_version
-- degerini hesaplayip iki ayri satir olarak insert edebilirdi (business_id +
-- document_version uzerinde unique constraint yok, yalnizca (business_id,
-- revision_id) unique — bu satirlari engellemez). Sonuc: ayni business icin
-- iki farkli revision, ayni document_version'a sahip olabilir; bu da
-- getLatestPublishedBuilderDocument/listBuilderPublicationVersions'in "en
-- guncel"i belirsiz/rastgele secmesine yol acar (iki "Aktif" surum).
--
-- Duzeltme: publish_builder_draft ile AYNI kilit kaynagini kullan —
-- business_site_builder_drafts satirini "for update" ile kilitle. Bu, ayni
-- business icin calisan HERHANGI bir publish veya rollback cagrisini bu
-- transaction commit/rollback olana kadar SERI hale getirir (Postgres'in
-- kendi row-lock bekleme mekanizmasi araciligiyla — ek bir advisory lock
-- gerekmez). document_version hesaplamasi artik bu kilit ALINDIKTAN SONRA
-- yapiliyor, boylece "oku + hesapla + yaz" ucgeni atomik hale gelir. Draft
-- satirinin SADECE OKUNMASI (yazilmamasi) "draft'a hicbir zaman yazma
-- yapilmaz" ilkesini bozmaz — kilit yalnizca karsilikli dislama icin
-- kullanilir, draft'in hicbir sutunu update edilmez.
-- ============================================================
create or replace function public.rollback_builder_publication(
  p_business_id uuid,
  p_target_revision_id uuid,
  p_note text default 'Geri alindi'
)
returns table (
  revision_id uuid,
  published_version integer,
  published_at timestamptz
)
language plpgsql
as $$
declare
  v_draft_id uuid;
  v_target public.business_publication_site_builder_documents%rowtype;
  v_ledger_version integer;
  v_next_published_version integer;
  v_revision_id uuid;
  v_now timestamptz := now();
begin
  if p_business_id is null or p_target_revision_id is null then
    raise exception 'business_id_and_target_revision_required';
  end if;

  -- publish_builder_draft ile PAYLASILAN kilit kaynagi: draft satirini
  -- (yalniz OKUMA amacli) kilitle. Bu satir uzerinde ayni anda calisan
  -- baska bir rollback veya publish, bu transaction commit/rollback olana
  -- kadar bekler — asagidaki document_version hesabi artik kilitsiz bir
  -- yaris degil, karsilikli dislama altinda calisir.
  select id
    into v_draft_id
    from public.business_site_builder_drafts
    where business_id = p_business_id
    for update;

  if not found then
    raise exception 'draft_not_found';
  end if;

  -- NOT: RETURNS TABLE(revision_id ...) bu fonksiyon govdesinde otomatik
  -- olarak "revision_id" adinda bir degisken tanimlar; tablo sutununu
  -- tam nitelenmis (table.column) yazmazsak Postgres "ambiguous column"
  -- hatasi verir. Bu yuzden asagida tabloyu acikca nitelendiriyoruz.
  select d.*
    into v_target
    from public.business_publication_site_builder_documents d
    where d.business_id = p_business_id
      and d.revision_id = p_target_revision_id;

  if not found then
    raise exception 'target_revision_not_found';
  end if;

  select coalesce(max(version), 0) + 1
    into v_ledger_version
    from public.business_publication_revisions
    where business_id = p_business_id;

  -- Rollback draft'a hicbir sekilde YAZMA yapmadigi icin (base_published_version
  -- güncellenmez), builder-local versiyon sayacini draft'tan degil, mevcut
  -- snapshot tablosunun kendisinden turetiyoruz — boylece publish ile ayni
  -- monoton sayaci paylasir, hicbir zaman geriye gitmez veya cakismaz. Bu
  -- SELECT artik yukaridaki "for update" kilidi altinda calistigi icin,
  -- ayni anda calisan baska bir rollback/publish bu degeri degistiremez.
  select coalesce(max(document_version), 0) + 1
    into v_next_published_version
    from public.business_publication_site_builder_documents
    where business_id = p_business_id;

  insert into public.business_publication_revisions (
    id, business_id, version, status, source, note, created_at, published_at
  ) values (
    gen_random_uuid(), p_business_id, v_ledger_version, 'preview', 'builder_rollback', coalesce(p_note, 'Geri alindi'), v_now, v_now
  )
  returning id into v_revision_id;

  insert into public.business_publication_site_builder_documents (
    id, business_id, revision_id, document, document_version, created_at
  ) values (
    gen_random_uuid(), p_business_id, v_revision_id, v_target.document, v_next_published_version, v_now
  );

  return query select v_revision_id, v_next_published_version, v_now;
end;
$$;

-- `revoke all from public` alone yetmiyor: Supabase bootstrap default
-- privileges yeni fonksiyonlara anon/authenticated icin dogrudan (PUBLIC
-- uzerinden degil) EXECUTE veriyor. Bu yuzden anon/authenticated'dan da
-- ayrica ve acikca revoke ediyoruz — aksi halde bu RPC'ler PostgREST
-- uzerinden anon/authenticated key'i ile dogrudan cagrilabilir kalirdi.
revoke all on function public.publish_builder_draft(uuid, integer, integer, text) from public;
revoke all on function public.rollback_builder_publication(uuid, uuid, text) from public;
revoke execute on function public.publish_builder_draft(uuid, integer, integer, text) from anon, authenticated;
revoke execute on function public.rollback_builder_publication(uuid, uuid, text) from anon, authenticated;

grant execute on function public.publish_builder_draft(uuid, integer, integer, text) to service_role;
grant execute on function public.rollback_builder_publication(uuid, uuid, text) to service_role;
