import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { renderToStaticMarkup } from "react-dom/server";

// REAL local Supabase/Postgres integration test for the Faz 11 public
// render pipeline — no mocks. Exercises resolvePublishedBuilderPage (page
// resolution + legacy-fallback rules) and resolvePublicBlockData (real
// panel-data adapter) against the local Supabase stack, plus renders the
// actual block PublicRenderer functions to real HTML via react-dom/server
// to prove real business data (not Faz 5's SAMPLE_SERVICES placeholder
// data) ends up on the page.
//
// jiti config notes:
// - jsx: {runtime:"automatic"} + fsCache:false + moduleCache:false is
//   required to actually render .tsx block components through jiti;
//   without it jiti emits classic-runtime JSX that references a global
//   `React` which is never defined, and fsCache can serve a stale
//   classic-runtime transform even after changing the jsx option.
// - Never reads `.env.local` (production project) — local URL/key are
//   hardcoded here, same convention as the other *-integration.test.mjs files.
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function isLocalSupabaseUp() {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/businesses?limit=1`, {
      headers: { apikey: LOCAL_SERVICE_ROLE_KEY, Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}` },
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

const localSupabaseUp = await isLocalSupabaseUp();

// Two SEPARATE jiti instances are required here, not one:
//
// jitiData: default caching, matches the exact config every other
// *-integration.test.mjs in this repo already uses. draft-store.ts /
// document-state.ts / workspace-state.ts all internally call
// getBlockDefinition() against the registry.ts Map that blocks/index.ts
// populates via `await jitiData.import(...)` — this only works because both
// the side-effect import AND the later `jitiData(path)` calls share ONE
// module cache/registry instance.
//
// jitiJsx: jsx:{runtime:"automatic"} + fsCache:false + moduleCache:false,
// used ONLY to actually render .tsx block components to HTML via
// react-dom/server (classic-runtime JSX needs a global `React` that's never
// defined; fsCache can also serve a stale classic-runtime transform after
// changing the jsx option). Disabling moduleCache here is safe ONLY because
// this instance never needs registry.ts Map-sharing across separate calls —
// it renders blocks via their DIRECT named exports from blocks/index.ts
// (heroBlock, ctaBlock, servicesGridBlock), never through getBlockDefinition.
const jitiData = createJiti(import.meta.url, {
  tsconfigPaths: true,
  jsx: true,
  alias: {
    "server-only": fileURLToPath(new URL("./support/server-only-stub.mjs", import.meta.url)),
  },
});

await jitiData.import("../lib/builder/blocks/index.ts");
const { asVariantKey } = jitiData("../lib/builder/types.ts");
const { resolvePublicBlockData } = jitiData("../lib/builder/public-data-adapter.ts");
const { resolveBuilderSeoHints, resolvePublishedBuilderPage } = jitiData("../lib/builder/public-render.ts");
const { withLocaleIfInternal, localizeHrefFields } = jitiData("../components/builder/public-page-renderer.tsx");
const { getBusinessBuilderDraft, saveBusinessBuilderDraft } = jitiData("../lib/builder/draft-store.ts");
const { publishBuilderDraft } = jitiData("../lib/builder/publish-store.ts");
const { builderDocumentReducer, createBuilderDraftPersistenceRecord, createInitialBuilderDocumentState } = jitiData(
  "../lib/builder/document-state.ts",
);

const jitiJsx = createJiti(import.meta.url, {
  tsconfigPaths: true,
  jsx: { runtime: "automatic", importSource: "react" },
  fsCache: false,
  moduleCache: false,
  alias: {
    "server-only": fileURLToPath(new URL("./support/server-only-stub.mjs", import.meta.url)),
  },
});

const blocks = await jitiJsx.import("../lib/builder/blocks/index.ts");

const BLOCKS_BY_KEY = {
  hero: blocks.heroBlock,
  services_grid: blocks.servicesGridBlock,
  cta: blocks.ctaBlock,
};

function restHeaders(extra = {}) {
  return {
    apikey: LOCAL_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function restFetch(path, init = {}) {
  return fetch(`${LOCAL_SUPABASE_URL}/rest/v1${path}`, { ...init, headers: restHeaders(init.headers) });
}

async function createTestBusiness(label) {
  const suffix = randomUUID();
  const res = await restFetch("/businesses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: `public-render-${label}-${suffix}`,
      email: `public-render-${label}-${suffix}@example.test`,
      domain: `public-render-${label}-${suffix}.example.test`,
    }),
  });
  const bodyText = await res.text();
  assert.equal(res.status, 201, `business insert failed: ${bodyText}`);
  return JSON.parse(bodyText)[0].id;
}

async function deleteTestBusiness(businessId) {
  await restFetch(`/businesses?id=eq.${businessId}`, { method: "DELETE" });
}

function setLocalEnv() {
  process.env.SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function fakePanel(services) {
  return {
    business: { id: "panel-business" },
    profile: { businessId: "panel-business", heroTitle: "", heroSubtitle: "", heroButtonText: "" },
    mediaAssets: [],
    customers: [],
    services,
    vehicles: [],
    routes: [],
    blogs: [],
    seo: { businessId: "panel-business", metaTitle: "", metaDescription: "", canonicalUrl: "", defaultLocale: "tr", hreflangEnabled: true },
    locales: [],
    requests: [],
  };
}

function renderBlock(blockKey, content, style, data) {
  const definition = BLOCKS_BY_KEY[blockKey];
  const section = {
    id: "s1",
    businessId: "b1",
    pageId: "p1",
    blockKey,
    variantKey: asVariantKey(blockKey === "hero" ? "centered" : blockKey === "cta" ? "centered" : "grid"),
    position: 0,
    active: true,
    content,
    style,
    responsive: {},
    createdAt: "",
    updatedAt: "",
  };
  const element = definition.PublicRenderer({ section, breakpoint: "desktop", data });
  return renderToStaticMarkup(element);
}

async function publishHomeWithHeroTitle(businessId, heroTitle) {
  const seeded = await getBusinessBuilderDraft(businessId);
  const baseState = createInitialBuilderDocumentState();
  const homeId = baseState.draft.workspace.pages[0].id;
  const heroSectionId = baseState.draft.workspace.pages[0].sections[0].id;
  const edited = builderDocumentReducer(baseState, {
    type: "update-section-content",
    pageId: homeId,
    sectionId: heroSectionId,
    patch: { title: heroTitle },
  });
  const document = createBuilderDraftPersistenceRecord(edited);
  const saved = await saveBusinessBuilderDraft({ businessId, document, expectedVersion: seeded.draftVersion, updatedBy: null });
  return publishBuilderDraft({
    businessId,
    expectedDraftVersion: saved.draftVersion,
    expectedPublishedVersion: saved.basePublishedVersion,
  });
}

// ------------------------------------------------------------
// Pure logic tests (no DB) — data adapter + href localization.
// ------------------------------------------------------------

test("resolvePublicBlockData: services_grid returns real, capped, sorted, active-only items", () => {
  const panel = fakePanel([
    { id: "svc-3", slug: "vip", title: "VIP Transfer", description: "d3", sortOrder: 3, active: true },
    { id: "svc-1", slug: "airport", title: "Havalimani Transferi", description: "d1", sortOrder: 1, active: true },
    { id: "svc-2", slug: "", title: "Inactive Service", description: "d2", sortOrder: 2, active: false },
  ]);

  const data = resolvePublicBlockData("services_grid", { maxItems: 1 }, panel, { pageKey: "services" });

  assert.equal(data.items.length, 1, "maxItems must cap the result");
  assert.equal(data.items[0].title, "Havalimani Transferi", "must be sorted by sortOrder, inactive items excluded");
  assert.equal(data.items[0].href, "/services/airport");
});

test("resolvePublicBlockData: falls back to id-based href when slug is empty", () => {
  const panel = fakePanel([{ id: "svc-no-slug", slug: "", title: "T", description: "d", sortOrder: 0, active: true }]);
  const data = resolvePublicBlockData("services_grid", {}, panel, { pageKey: "services" });
  assert.equal(data.items[0].href, "/services/svc-no-slug");
});

test("resolvePublicBlockData: hero/cta blocks need no external data", () => {
  const panel = fakePanel([]);
  assert.equal(resolvePublicBlockData("hero", {}, panel, { pageKey: "home" }), undefined);
  assert.equal(resolvePublicBlockData("cta", {}, panel, { pageKey: "home" }), undefined);
});

test("resolvePublicBlockData: same services_grid block maps to vehicles/routes/blogs based on pageKey", () => {
  const panel = {
    ...fakePanel([]),
    vehicles: [{ id: "veh-1", slug: "vito", title: "Mercedes Vito", description: "d", sortOrder: 0, active: true }],
    routes: [{ id: "rt-1", slug: "airport-city", title: "Havalimanı - Şehir Merkezi", description: "d", sortOrder: 0, active: true }],
    blogs: [{ id: "post-1", slug: "seyahat-ipuclari", title: "Seyahat İpuçları", excerpt: "kısa özet", content: "uzun içerik", sortOrder: 0, published: true }],
  };

  const vehicles = resolvePublicBlockData("services_grid", {}, panel, { pageKey: "vehicles" });
  assert.equal(vehicles.items[0].title, "Mercedes Vito");
  assert.equal(vehicles.items[0].href, "/vehicles/vito");

  const routes = resolvePublicBlockData("services_grid", {}, panel, { pageKey: "routes" });
  assert.equal(routes.items[0].title, "Havalimanı - Şehir Merkezi");
  assert.equal(routes.items[0].href, "/routes/airport-city");

  const blogs = resolvePublicBlockData("services_grid", {}, panel, { pageKey: "blog" });
  assert.equal(blogs.items[0].title, "Seyahat İpuçları");
  assert.equal(blogs.items[0].description, "kısa özet", "excerpt must be preferred over full content");
  assert.equal(blogs.items[0].href, "/blog/seyahat-ipuclari");

  // unpublished blog posts must be excluded, just like inactive services/vehicles/routes
  const draftOnly = { ...panel, blogs: [{ id: "post-2", slug: "taslak", title: "Taslak", excerpt: "", content: "", sortOrder: 0, published: false }] };
  const noBlogs = resolvePublicBlockData("services_grid", {}, draftOnly, { pageKey: "blog" });
  assert.equal(noBlogs.items.length, 0);

  // an unmapped pageKey (e.g. "contact") must safely default to services, never throw
  const fallback = resolvePublicBlockData("services_grid", {}, panel, { pageKey: "contact" });
  assert.equal(fallback.items.length, 0);
});

test("withLocaleIfInternal: appends lang to internal paths, leaves external/anchor/mailto untouched", () => {
  assert.equal(withLocaleIfInternal("/quote", "tr"), "/quote?lang=tr");
  assert.equal(withLocaleIfInternal("/quote?ref=x", "tr"), "/quote?ref=x&lang=tr");
  assert.equal(withLocaleIfInternal("https://external.example.com", "tr"), "https://external.example.com");
  assert.equal(withLocaleIfInternal("mailto:a@b.com", "tr"), "mailto:a@b.com");
  assert.equal(withLocaleIfInternal("#pricing", "tr"), "#pricing");
});

test("localizeHrefFields: only rewrites the known href fields for hero/cta, leaves other blocks untouched", () => {
  const hero = localizeHrefFields("hero", { primaryButtonHref: "/quote", secondaryButtonHref: "/contact", title: "T" }, "de");
  assert.equal(hero.primaryButtonHref, "/quote?lang=de");
  assert.equal(hero.secondaryButtonHref, "/contact?lang=de");
  assert.equal(hero.title, "T");

  const cta = localizeHrefFields("cta", { primaryButtonHref: "/quote" }, "de");
  assert.equal(cta.primaryButtonHref, "/quote?lang=de");

  const untouched = localizeHrefFields("services_grid", { maxItems: 6 }, "de");
  assert.deepEqual(untouched, { maxItems: 6 });
});

test("real block rendering: hero + services_grid + cta render actual business content as HTML, not placeholder text", () => {
  const panel = fakePanel([
    { id: "svc-1", slug: "airport-transfer", title: "GERCEK Havalimani Hizmeti", description: "gercek aciklama", sortOrder: 0, active: true },
  ]);

  const heroHtml = renderBlock(
    "hero",
    { eyebrow: "e", title: "Gercek Tenant Basligi", subtitle: "s", primaryButtonText: "Teklif al", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "" },
    { align: "left", overlay: "none" },
    undefined,
  );
  assert.match(heroHtml, /Gercek Tenant Basligi/);

  const servicesData = resolvePublicBlockData("services_grid", { maxItems: 6 }, panel, { pageKey: "home" });
  const servicesHtml = renderBlock(
    "services_grid",
    { eyebrow: "e", title: "t", description: "d", emptyStateTitle: "empty", emptyStateDescription: "empty desc", maxItems: 6 },
    { columns: 3 },
    servicesData,
  );
  assert.match(servicesHtml, /GERCEK Havalimani Hizmeti/, "real panel service must appear in the rendered HTML");
  assert.match(servicesHtml, /href="\/services\/airport-transfer"/);
  assert.doesNotMatch(servicesHtml, /Havalimanı Transferi/, "Faz 5's SAMPLE_SERVICES placeholder text must never leak into public HTML");

  const ctaHtml = renderBlock("cta", { title: "Gercek CTA Basligi", description: "d", primaryButtonText: "Git", primaryButtonHref: "/quote" }, { tone: "brand" }, undefined);
  assert.match(ctaHtml, /Gercek CTA Basligi/);
});

test("resolveBuilderSeoHints: interpolates {business}, sanitizes length, returns null when unset or no page", () => {
  assert.deepEqual(resolveBuilderSeoHints(null, "Acme Transfer"), { title: null, description: null });

  const page = {
    seoTitleHint: "{business} | Havalimanı Transfer",
    seoDescriptionHint: "  {business} ile güvenli ve konforlu transfer.  ",
  };
  const hints = resolveBuilderSeoHints(page, "Acme Transfer");
  assert.equal(hints.title, "Acme Transfer | Havalimanı Transfer");
  assert.equal(hints.description, "Acme Transfer ile güvenli ve konforlu transfer.");

  assert.deepEqual(resolveBuilderSeoHints({ seoTitleHint: "", seoDescriptionHint: "   " }, "Acme"), {
    title: null,
    description: null,
  });

  const longTitle = "A".repeat(120);
  const longDescription = "B".repeat(300);
  const truncated = resolveBuilderSeoHints({ seoTitleHint: longTitle, seoDescriptionHint: longDescription }, "Acme");
  assert.equal(truncated.title.length, 70, "title must be capped to a sane SEO length");
  assert.equal(truncated.description.length, 160, "description must be capped to a sane SEO length");

  // malformed field types must never throw
  const malformed = resolveBuilderSeoHints({ seoTitleHint: 42, seoDescriptionHint: null }, "Acme");
  assert.deepEqual(malformed, { title: null, description: null });
});

test("theme marker classes: builder output carries the ps-* hooks the Luxury CSS targets", () => {
  const panel = fakePanel([
    { id: "svc-1", slug: "airport-transfer", title: "Havalimani Hizmeti", description: "d", sortOrder: 0, active: true },
  ]);

  const heroHtml = renderBlock(
    "hero",
    { eyebrow: "e", title: "T", subtitle: "s", primaryButtonText: "Teklif al", primaryButtonHref: "/quote", secondaryButtonText: "Iletisim", secondaryButtonHref: "/contact" },
    { align: "left", overlay: "none" },
    undefined,
  );
  assert.match(heroHtml, /class="ps-hero flex/, "hero container must carry ps-hero for luxury surface/border/padding");
  assert.match(heroHtml, /\bps-hero-title\b/, "hero H1 must carry ps-hero-title for luxury color/font");
  assert.match(heroHtml, /\bps-cta-primary\b/, "hero primary button must carry ps-cta-primary");
  assert.match(heroHtml, /\bps-cta-secondary\b/, "hero secondary button must carry ps-cta-secondary");

  const servicesData = resolvePublicBlockData("services_grid", { maxItems: 6 }, panel, { pageKey: "home" });
  const servicesHtml = renderBlock(
    "services_grid",
    { eyebrow: "e", title: "t", description: "d", emptyStateTitle: "empty", emptyStateDescription: "empty desc", maxItems: 6 },
    { columns: 3 },
    servicesData,
  );
  assert.match(servicesHtml, /\bps-heading\b/);
  assert.match(servicesHtml, /\bps-subtext\b/);
  assert.match(servicesHtml, /\bps-card\b/);
  assert.match(servicesHtml, /\bps-card-title\b/);
  assert.match(servicesHtml, /\bps-card-text\b/);
});

// ------------------------------------------------------------
// Real local Supabase integration tests — resolvePublishedBuilderPage.
// ------------------------------------------------------------

test(
  "website builder public render — real local Supabase integration",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    await t.test("legacy fallback: business with no builder publish ever -> null", async () => {
      const businessId = await createTestBusiness("no-publish");
      try {
        const page = await resolvePublishedBuilderPage(businessId, "home");
        assert.equal(page, null, "no published document yet -> legacy must keep serving");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("published home page resolves with real edited content", async () => {
      const businessId = await createTestBusiness("valid-home");
      try {
        await publishHomeWithHeroTitle(businessId, "Yayinlanmis Gercek Baslik");

        const resolved = await resolvePublishedBuilderPage(businessId, "home");
        assert.ok(resolved, "an active published home page must resolve");
        assert.ok(resolved.revisionId, "Faz 13: resolution must also return the revisionId (needed for translation lookup)");
        assert.equal(resolved.page.key, "home");
        const hero = resolved.page.sections.find((s) => s.blockKey === "hero");
        assert.equal(hero.content.title, "Yayinlanmis Gercek Baslik");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("legacy fallback: published but home page is inactive", async () => {
      const businessId = await createTestBusiness("inactive-home");
      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const baseState = createInitialBuilderDocumentState();
        const homeId = baseState.draft.workspace.pages[0].id;
        const edited = builderDocumentReducer(baseState, { type: "update-page", pageId: homeId, patch: { active: false } });
        const document = createBuilderDraftPersistenceRecord(edited);
        const saved = await saveBusinessBuilderDraft({ businessId, document, expectedVersion: seeded.draftVersion, updatedBy: null });
        await publishBuilderDraft({
          businessId,
          expectedDraftVersion: saved.draftVersion,
          expectedPublishedVersion: saved.basePublishedVersion,
        });

        const page = await resolvePublishedBuilderPage(businessId, "home");
        assert.equal(page, null, "an inactive published page must fall back to legacy, not render an empty/hidden page");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("legacy fallback: page key that does not exist in the published document", async () => {
      const businessId = await createTestBusiness("missing-key");
      try {
        await publishHomeWithHeroTitle(businessId, "x");
        const page = await resolvePublishedBuilderPage(businessId, "some-page-that-does-not-exist");
        assert.equal(page, null);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("legacy fallback: corrupted published snapshot must not crash resolution", async () => {
      const businessId = await createTestBusiness("corrupted-snapshot");
      try {
        await getBusinessBuilderDraft(businessId);

        // Gercek publish akisini (RPC) atlayarak dogrudan bozuk bir satir
        // ekliyoruz — production'da asla olusmamasi gereken ama render
        // katmaninin yine de guvenle atlatmasi gereken bir senaryo.
        const revisionRes = await restFetch("/business_publication_revisions", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ business_id: businessId, version: 1, status: "preview", source: "builder", note: "corrupt-test" }),
        });
        const [revision] = await revisionRes.json();

        await restFetch("/business_publication_site_builder_documents", {
          method: "POST",
          body: JSON.stringify({
            business_id: businessId,
            revision_id: revision.id,
            document: { workspace: { pages: "not-an-array" } },
            document_version: 1,
          }),
        });

        const page = await resolvePublishedBuilderPage(businessId, "home");
        assert.equal(page, null, "a corrupted snapshot must resolve to null (legacy fallback), never throw");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("tenant isolation: business A's published home never resolves for business B", async () => {
      const businessA = await createTestBusiness("tenant-a");
      const businessB = await createTestBusiness("tenant-b");
      try {
        await publishHomeWithHeroTitle(businessA, "Sadece A icin baslik");

        const pageA = await resolvePublishedBuilderPage(businessA, "home");
        const pageB = await resolvePublishedBuilderPage(businessB, "home");

        assert.ok(pageA);
        assert.equal(pageB, null, "business B has no publish of its own and must not see business A's page");
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    await t.test("Faz 12: publishing the UNEDITED default seed resolves clean content on all 6 system pages", async () => {
      const businessId = await createTestBusiness("default-seed");
      const forbiddenTerms = [
        "Website Builder",
        "Canli preview",
        "Canlı preview",
        "Blok ekle",
        "Editör",
        "Demo",
        "Mock",
        "Sample",
        "preview state",
        "builder oturumu",
        "#pages",
        "#inspector",
        "#services",
        "#vehicles",
        "#routes",
        "#blog",
        "/app/website-builder",
      ];

      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        // Kasıtlı olarak HİÇBİR düzenleme yapmadan doğrudan varsayılan
        // seed'i yayınlıyoruz — bu, gerçek bir tenant'ın hiç dokunmadan
        // "Yayınla"ya bastığı en riskli senaryodur (Faz 12 madde 4).
        await publishBuilderDraft({
          businessId,
          expectedDraftVersion: seeded.draftVersion,
          expectedPublishedVersion: seeded.basePublishedVersion,
        });

        for (const pageKey of ["home", "services", "vehicles", "routes", "blog", "contact"]) {
          const resolved = await resolvePublishedBuilderPage(businessId, pageKey);
          assert.ok(resolved, `default seed must publish an active "${pageKey}" page`);
          const page = resolved.page;

          const serialized = JSON.stringify(page);
          for (const term of forbiddenTerms) {
            assert.doesNotMatch(
              serialized,
              new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
              `"${pageKey}" page must not contain builder-tool/demo copy ("${term}")`,
            );
          }

          const hero = page.sections.find((section) => section.blockKey === "hero");
          assert.ok(hero.content.title.trim().length > 0, `"${pageKey}" hero must have real title text`);
          // Hero/CTA butonları gercek public route'lara isaret etmeli
          // (goreli "/..." veya "#" ile baslayan ic-sayfa anchor'lari degil,
          // gercekten var olan bir route).
          const realPublicRoutes = new Set(["/", "/quote", "/contact", "/booking", "/services", "/vehicles", "/routes", "/blog"]);
          if (hero.content.primaryButtonHref) {
            assert.ok(
              realPublicRoutes.has(hero.content.primaryButtonHref),
              `"${pageKey}" hero primary href "${hero.content.primaryButtonHref}" must be a real public route`,
            );
          }
        }
      } finally {
        await deleteTestBusiness(businessId);
      }
    });
  },
);
