import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// REAL local Supabase/Postgres integration test for the Faz 13 multi-language,
// Contact-integration, version-history and rollback work — no mocks. Follows
// the exact same conventions as website-builder-publish-integration.test.mjs
// and website-builder-public-render-integration.test.mjs: hardcoded local
// URL/key (never reads `.env.local`), a single jiti instance (no JSX
// rendering needed in this file), businesses created/deleted per test.
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

const jiti = createJiti(import.meta.url, {
  tsconfigPaths: true,
  jsx: true,
  alias: {
    "server-only": fileURLToPath(new URL("./support/server-only-stub.mjs", import.meta.url)),
  },
});

await jiti.import("../lib/builder/blocks/index.ts");

const { getBusinessBuilderDraft, saveBusinessBuilderDraft } = jiti("../lib/builder/draft-store.ts");
const {
  BuilderRollbackNotFoundError,
  getBuilderPublicationVersion,
  listBuilderPublicationVersions,
  publishBuilderDraft,
  rollbackBuilderPublication,
} = jiti("../lib/builder/publish-store.ts");
const {
  applyBuilderSectionTranslations,
  loadBuilderTranslationDrafts,
  loadPublishedBuilderTranslationLookup,
  resolveBuilderPageSeoOverride,
  saveBuilderTranslations,
} = jiti("../lib/builder/translations.ts");
const { resolveBuilderSeoHints, resolvePublishedBuilderPage, resolvePublishedBuilderTranslations } = jiti(
  "../lib/builder/public-render.ts",
);
const { isRTLLanguage } = jiti("../lib/languages.ts");
const { builderDocumentReducer, createBuilderDraftPersistenceRecord, createInitialBuilderDocumentState } = jiti(
  "../lib/builder/document-state.ts",
);
const { asBlockKey } = jiti("../lib/builder/types.ts");

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
      name: `builder-i18n-${label}-${suffix}`,
      email: `builder-i18n-${label}-${suffix}@example.test`,
      domain: `builder-i18n-${label}-${suffix}.example.test`,
    }),
  });
  const bodyText = await res.text();
  assert.equal(res.status, 201, `business insert failed: ${bodyText}`);
  return JSON.parse(bodyText)[0].id;
}

async function deleteTestBusiness(businessId) {
  await restFetch(`/businesses?id=eq.${businessId}`, { method: "DELETE" });
}

async function readBuilderDocuments(businessId) {
  const res = await restFetch(
    `/business_publication_site_builder_documents?business_id=eq.${businessId}&order=document_version.asc`,
  );
  return res.json();
}

function setLocalEnv() {
  process.env.SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function findPage(document, key) {
  return document.workspace.pages.find((page) => page.key === key);
}

function findSection(page, blockKey) {
  return page.sections.find((section) => section.blockKey === blockKey);
}

// Var olan (gercekten seed edilmis / bir onceki save'den donen) document'i
// klonlayip yalnizca hedef section'in content'ini degistirir — TUM diger
// page/section id'lerini AYNEN korur. Faz 10/11 testlerindeki editHomeTitle
// helper'i bilerek YENI rastgele id'ler ureten bir taze workspace kullanir
// (yalnizca "publish'in icerigi kopyaladigini" kanitlamak icin yeterli); ama
// bu dosyadaki ceviri testleri, "translation kaydi hala ayni sourceId'ye
// isaret ediyor mu" sorusunu sorduğu icin id'lerin ISTIKRARLI kalmasi sart.
function withEditedHeroTitle(previousDocument, title) {
  const workspace = structuredClone(previousDocument.workspace);
  const homePage = workspace.pages.find((page) => page.key === "home");
  const heroSection = findSection(homePage, "hero");
  heroSection.content = { ...heroSection.content, title };
  return { version: previousDocument.version, savedAt: new Date().toISOString(), workspace };
}

test(
  "website builder translations, contact integration, version history & rollback — real local Supabase integration",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    // ------------------------------------------------------------
    // Builder translation save/load.
    // ------------------------------------------------------------

    await t.test("EN override on a section field is saved, read back, and never mutates the default-locale document", async () => {
      const businessId = await createTestBusiness("en-section");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const heroSection = findSection(findPage(draft.document, "home"), "hero");
        const originalTitle = heroSection.content.title;

        const { saved, issues } = await saveBuilderTranslations({
          businessId,
          localeCode: "en",
          entries: [{ sourceId: heroSection.id, fieldKey: "title", translatedText: "Airport Transfer Service" }],
        });

        assert.equal(issues.length, 0);
        assert.equal(saved.length, 1);
        assert.equal(saved[0].translatedText, "Airport Transfer Service");

        const loaded = await loadBuilderTranslationDrafts(businessId, "en");
        assert.equal(loaded.length, 1);
        assert.equal(loaded[0].sourceId, heroSection.id);
        assert.equal(loaded[0].fieldKey, "title");
        assert.equal(loaded[0].translatedText, "Airport Transfer Service");

        const reloadedDraft = await getBusinessBuilderDraft(businessId);
        const reloadedHero = findSection(findPage(reloadedDraft.document, "home"), "hero");
        assert.equal(reloadedHero.content.title, originalTitle, "the default-locale document itself must never be touched by saving a translation");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("DE override on a page-level SEO field; saving an empty override deletes the translation (no-translation state)", async () => {
      const businessId = await createTestBusiness("de-page-seo");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const homePage = findPage(draft.document, "home");

        const first = await saveBuilderTranslations({
          businessId,
          localeCode: "de",
          entries: [{ sourceId: homePage.id, fieldKey: "seoTitleHint", translatedText: "Flughafentransfer Service" }],
        });
        assert.equal(first.issues.length, 0);
        assert.equal((await loadBuilderTranslationDrafts(businessId, "de")).length, 1);

        const cleared = await saveBuilderTranslations({
          businessId,
          localeCode: "de",
          entries: [{ sourceId: homePage.id, fieldKey: "seoTitleHint", translatedText: "" }],
        });
        assert.equal(cleared.issues.length, 0);
        assert.equal(
          (await loadBuilderTranslationDrafts(businessId, "de")).length,
          0,
          "an empty override must delete the translation, not save a blank string",
        );
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("Russian Cyrillic and Arabic RTL translation text round-trips byte-exact (no mojibake)", async () => {
      const businessId = await createTestBusiness("cyrillic-rtl");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const ctaSection = findSection(findPage(draft.document, "home"), "cta");

        const russianText = "Трансфер из аэропорта — быстро и надёжно";
        const arabicText = "خدمة النقل من المطار بأمان وراحة";

        await saveBuilderTranslations({
          businessId,
          localeCode: "ru",
          entries: [{ sourceId: ctaSection.id, fieldKey: "title", translatedText: russianText }],
        });
        await saveBuilderTranslations({
          businessId,
          localeCode: "ar",
          entries: [{ sourceId: ctaSection.id, fieldKey: "title", translatedText: arabicText }],
        });

        const ru = await loadBuilderTranslationDrafts(businessId, "ru");
        const ar = await loadBuilderTranslationDrafts(businessId, "ar");

        assert.equal(ru[0].translatedText, russianText, "Cyrillic text must round-trip exactly, byte for byte");
        assert.equal(ar[0].translatedText, arabicText, "Arabic text must round-trip exactly, byte for byte");

        assert.equal(isRTLLanguage("ar"), true);
        assert.equal(isRTLLanguage("ru"), false);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("missing translation for a locale falls back to default-locale content, unchanged reference", async () => {
      const businessId = await createTestBusiness("missing-fallback");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const heroSection = findSection(findPage(draft.document, "home"), "hero");

        const emptyLookup = new Map();
        const result = applyBuilderSectionTranslations("hero", heroSection.content, heroSection.id, emptyLookup, "fr", "tr");

        assert.strictEqual(result, heroSection.content, "no override anywhere -> the exact same content reference must be returned, no needless copy");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("invalid sourceId and disallowed fieldKey are both rejected as issues, no rows written", async () => {
      const businessId = await createTestBusiness("invalid-key");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const heroSection = findSection(findPage(draft.document, "home"), "hero");

        const { saved, issues } = await saveBuilderTranslations({
          businessId,
          localeCode: "es",
          entries: [
            { sourceId: "does-not-exist", fieldKey: "title", translatedText: "x" },
            { sourceId: heroSection.id, fieldKey: "maxItems", translatedText: "y" }, // not in hero's whitelist
          ],
        });

        assert.equal(issues.length, 2);
        assert.equal(saved.length, 0);
        assert.equal((await loadBuilderTranslationDrafts(businessId, "es")).length, 0);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("cross-tenant translation write attempt is rejected — another business's sourceId is meaningless here", async () => {
      const businessA = await createTestBusiness("cross-a");
      const businessB = await createTestBusiness("cross-b");
      try {
        await getBusinessBuilderDraft(businessA);
        const draftB = await getBusinessBuilderDraft(businessB);
        const heroB = findSection(findPage(draftB.document, "home"), "hero");

        const { saved, issues } = await saveBuilderTranslations({
          businessId: businessA,
          localeCode: "en",
          entries: [{ sourceId: heroB.id, fieldKey: "title", translatedText: "hacked" }],
        });

        assert.equal(saved.length, 0);
        assert.equal(issues.length, 1);
        assert.match(issues[0].message, /degil|bilinen/i);

        assert.equal((await loadBuilderTranslationDrafts(businessA, "en")).length, 0);
        assert.equal((await loadBuilderTranslationDrafts(businessB, "en")).length, 0, "the write must not land on business B either");
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    await t.test("draft translation added AFTER a publish never leaks into that already-published revision's lookup", async () => {
      const businessId = await createTestBusiness("no-leak");
      try {
        await getBusinessBuilderDraft(businessId);
        const v1 = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const draftAfterV1 = await getBusinessBuilderDraft(businessId);
        const heroSection = findSection(findPage(draftAfterV1.document, "home"), "hero");

        await saveBuilderTranslations({
          businessId,
          localeCode: "en",
          entries: [{ sourceId: heroSection.id, fieldKey: "title", translatedText: "Added After V1" }],
        });

        const lookupV1 = await loadPublishedBuilderTranslationLookup(businessId, v1.revisionId);
        assert.equal(lookupV1.size, 0, "a translation added after v1 was published must not retroactively appear in v1's snapshot");

        const cachedLookupV1 = await resolvePublishedBuilderTranslations(businessId, v1.revisionId);
        assert.equal(cachedLookupV1.size, 0, "the public-render-facing cached resolver must have the same isolation guarantee");

        // A NEW publish, taken after the translation exists in the draft-level
        // table, must snapshot it (this is the mechanism, not a leak: v2 is a
        // genuinely new revision created from the CURRENT draft state).
        const edited = withEditedHeroTitle(draftAfterV1.document, "v2 icerik");
        const saved = await saveBusinessBuilderDraft({
          businessId,
          document: edited,
          expectedVersion: draftAfterV1.draftVersion,
          updatedBy: null,
        });
        const v2 = await publishBuilderDraft({
          businessId,
          expectedDraftVersion: saved.draftVersion,
          expectedPublishedVersion: saved.basePublishedVersion,
        });

        const lookupV2 = await loadPublishedBuilderTranslationLookup(businessId, v2.revisionId);
        const entry = lookupV2.get(`en:builder:${heroSection.id}:title`);
        assert.ok(entry, "v2's snapshot must contain the translation that existed in the draft at v2's publish time");
        assert.equal(entry.translatedText, "Added After V1");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("public render resolution: EN override replaces title, missing field (subtitle) falls back to default", async () => {
      const businessId = await createTestBusiness("public-resolve");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const heroSection = findSection(findPage(draft.document, "home"), "hero");

        await saveBuilderTranslations({
          businessId,
          localeCode: "en",
          entries: [{ sourceId: heroSection.id, fieldKey: "title", translatedText: "Real Airport Transfer" }],
        });

        await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const resolved = await resolvePublishedBuilderPage(businessId, "home");
        assert.ok(resolved);
        const lookup = await resolvePublishedBuilderTranslations(businessId, resolved.revisionId);
        const heroPublished = findSection(resolved.page, "hero");

        const applied = applyBuilderSectionTranslations("hero", heroPublished.content, heroPublished.id, lookup, "en", "tr");

        assert.equal(applied.title, "Real Airport Transfer");
        assert.equal(applied.subtitle, heroPublished.content.subtitle, "field with no override must fall back to default-locale content");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    // ------------------------------------------------------------
    // SEO locale fallback chain.
    // ------------------------------------------------------------

    await t.test("SEO fallback chain: locale === fallbackLocale short-circuits to no override; locale override wins over default hint when present", async () => {
      const businessId = await createTestBusiness("seo-fallback");
      try {
        await getBusinessBuilderDraft(businessId);
        await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const resolved1 = await resolvePublishedBuilderPage(businessId, "home");
        assert.ok(resolved1);

        // 1) default locale (tr === fallback) -> never an override, regardless of lookup contents.
        const trOverride = resolveBuilderPageSeoOverride(resolved1.page, new Map([["tr:builder:x:seoTitleHint", { translatedText: "should never be used" }]]), "tr", "tr");
        assert.deepEqual(trOverride, { seoTitleHint: null, seoDescriptionHint: null });

        // 2) EN, no translation saved yet -> falls through to the default builder SEO hint (layer 2 of the chain).
        const lookupEmpty = await resolvePublishedBuilderTranslations(businessId, resolved1.revisionId);
        const enOverrideEmpty = resolveBuilderPageSeoOverride(resolved1.page, lookupEmpty, "en", "tr");
        assert.deepEqual(enOverrideEmpty, { seoTitleHint: null, seoDescriptionHint: null });
        const hintsWithoutOverride = resolveBuilderSeoHints(resolved1.page, "Acme Transfer", enOverrideEmpty);
        const hintsDefaultOnly = resolveBuilderSeoHints(resolved1.page, "Acme Transfer");
        assert.deepEqual(hintsWithoutOverride, hintsDefaultOnly, "with no locale override, resolved hints must equal the plain default-hint fallback");

        // 3) Now save an EN SEO override and republish so it gets snapshotted -> layer 1 of the chain wins.
        const draftAfterV1 = await getBusinessBuilderDraft(businessId);
        const homePage = findPage(draftAfterV1.document, "home");
        await saveBuilderTranslations({
          businessId,
          localeCode: "en",
          entries: [{ sourceId: homePage.id, fieldKey: "seoTitleHint", translatedText: "Airport Transfer Booking | {business}" }],
        });
        const edited = withEditedHeroTitle(draftAfterV1.document, "v2 icerik");
        const saved = await saveBusinessBuilderDraft({ businessId, document: edited, expectedVersion: draftAfterV1.draftVersion, updatedBy: null });
        const v2 = await publishBuilderDraft({ businessId, expectedDraftVersion: saved.draftVersion, expectedPublishedVersion: saved.basePublishedVersion });

        const resolved2 = await resolvePublishedBuilderPage(businessId, "home");
        const lookup2 = await resolvePublishedBuilderTranslations(businessId, resolved2.revisionId);
        assert.equal(resolved2.revisionId, v2.revisionId);

        const enOverride2 = resolveBuilderPageSeoOverride(resolved2.page, lookup2, "en", "tr");
        assert.equal(enOverride2.seoTitleHint, "Airport Transfer Booking | {business}");

        const hints2 = resolveBuilderSeoHints(resolved2.page, "Acme Transfer", enOverride2);
        assert.match(hints2.title, /Airport Transfer Booking/, "locale-specific SEO override must win over the default builder SEO hint");
        assert.match(hints2.title, /Acme Transfer/, "{business} placeholder must still be interpolated inside the locale override");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    // ------------------------------------------------------------
    // Contact page integration (partial builder content, form untouched).
    // ------------------------------------------------------------

    await t.test("Contact page: no builder publish yet -> resolves null (legacy PublicQuoteForm renders alone)", async () => {
      const businessId = await createTestBusiness("contact-legacy");
      try {
        const resolved = await resolvePublishedBuilderPage(businessId, "contact");
        assert.equal(resolved, null);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("Contact page: active builder page resolves alongside the (untouched) legacy quote form flow", async () => {
      const businessId = await createTestBusiness("contact-builder");
      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        await publishBuilderDraft({ businessId, expectedDraftVersion: seeded.draftVersion, expectedPublishedVersion: seeded.basePublishedVersion });

        const resolved = await resolvePublishedBuilderPage(businessId, "contact");
        assert.ok(resolved, "the default seed's contact page must publish active");
        assert.equal(resolved.page.key, "contact");
        assert.ok(resolved.page.sections.length > 0);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    // ------------------------------------------------------------
    // Version history.
    // ------------------------------------------------------------

    await t.test("listBuilderPublicationVersions carries the note through and flags isActive correctly", async () => {
      const businessId = await createTestBusiness("version-notes");
      try {
        await getBusinessBuilderDraft(businessId);
        await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1, note: "İlk sürüm notu" });

        const draftAfterV1 = await getBusinessBuilderDraft(businessId);
        const edited = withEditedHeroTitle(draftAfterV1.document, "v2 icerik");
        const saved = await saveBusinessBuilderDraft({ businessId, document: edited, expectedVersion: draftAfterV1.draftVersion, updatedBy: null });
        await publishBuilderDraft({
          businessId,
          expectedDraftVersion: saved.draftVersion,
          expectedPublishedVersion: saved.basePublishedVersion,
          note: "İkinci sürüm notu",
        });

        const versions = await listBuilderPublicationVersions(businessId);
        assert.equal(versions.length, 2);
        assert.equal(versions[0].note, "İkinci sürüm notu");
        assert.equal(versions[0].isActive, true);
        assert.equal(versions[1].note, "İlk sürüm notu");
        assert.equal(versions[1].isActive, false);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("getBuilderPublicationVersion is tenant-scoped: identical version numbers across two tenants never cross-contaminate", async () => {
      const businessA = await createTestBusiness("version-tenant-a");
      const businessB = await createTestBusiness("version-tenant-b");
      try {
        const draftA = await getBusinessBuilderDraft(businessA);
        const draftB = await getBusinessBuilderDraft(businessB);

        const editedA = withEditedHeroTitle(draftA.document, "SADECE A icerigi");
        const editedB = withEditedHeroTitle(draftB.document, "SADECE B icerigi");
        const savedA = await saveBusinessBuilderDraft({ businessId: businessA, document: editedA, expectedVersion: 1, updatedBy: null });
        const savedB = await saveBusinessBuilderDraft({ businessId: businessB, document: editedB, expectedVersion: 1, updatedBy: null });

        const publishedA = await publishBuilderDraft({ businessId: businessA, expectedDraftVersion: savedA.draftVersion, expectedPublishedVersion: savedA.basePublishedVersion });
        const publishedB = await publishBuilderDraft({ businessId: businessB, expectedDraftVersion: savedB.draftVersion, expectedPublishedVersion: savedB.basePublishedVersion });

        assert.equal(publishedA.publishedVersion, publishedB.publishedVersion, "both tenants' first publish independently lands on the same version NUMBER (2) — the interesting case");

        const docA = await getBuilderPublicationVersion(businessA, publishedA.publishedVersion);
        const docB = await getBuilderPublicationVersion(businessB, publishedB.publishedVersion);

        assert.equal(findSection(findPage(docA, "home"), "hero").content.title, "SADECE A icerigi");
        assert.equal(findSection(findPage(docB, "home"), "hero").content.title, "SADECE B icerigi");

        assert.equal(await getBuilderPublicationVersion(businessA, 999), null);
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    // ------------------------------------------------------------
    // Rollback.
    // ------------------------------------------------------------

    await t.test("rollback copies the target revision's translation snapshot forward, and never touches the draft's own translations", async () => {
      const businessId = await createTestBusiness("rollback-translations");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const heroSection = findSection(findPage(draft.document, "home"), "hero");

        await saveBuilderTranslations({
          businessId,
          localeCode: "en",
          entries: [{ sourceId: heroSection.id, fieldKey: "title", translatedText: "V1 English Title" }],
        });
        const v1 = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const draftAfterV1 = await getBusinessBuilderDraft(businessId);
        const edited = withEditedHeroTitle(draftAfterV1.document, "v2 icerik");
        const saved = await saveBusinessBuilderDraft({ businessId, document: edited, expectedVersion: draftAfterV1.draftVersion, updatedBy: null });
        await publishBuilderDraft({ businessId, expectedDraftVersion: saved.draftVersion, expectedPublishedVersion: saved.basePublishedVersion });

        const draftTranslationsBeforeRollback = await loadBuilderTranslationDrafts(businessId, "en");

        const rollback = await rollbackBuilderPublication(businessId, v1.revisionId);

        const lookupAfterRollback = await loadPublishedBuilderTranslationLookup(businessId, rollback.revisionId);
        const entry = lookupAfterRollback.get(`en:builder:${heroSection.id}:title`);
        assert.ok(entry, "rollback must copy the target revision's translation snapshot to the new revision");
        assert.equal(entry.translatedText, "V1 English Title");

        const draftTranslationsAfterRollback = await loadBuilderTranslationDrafts(businessId, "en");
        assert.deepEqual(
          draftTranslationsAfterRollback.map((r) => r.translatedText),
          draftTranslationsBeforeRollback.map((r) => r.translatedText),
          "rollback must never mutate the draft-level translation table",
        );
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("cross-tenant rollback is rejected — a real revisionId belonging to another tenant cannot be rolled back into", async () => {
      const businessA = await createTestBusiness("rollback-cross-a");
      const businessB = await createTestBusiness("rollback-cross-b");
      try {
        await getBusinessBuilderDraft(businessA);
        await getBusinessBuilderDraft(businessB);
        const publishedA = await publishBuilderDraft({ businessId: businessA, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        await assert.rejects(
          () => rollbackBuilderPublication(businessB, publishedA.revisionId),
          BuilderRollbackNotFoundError,
          "business B must never be able to roll back using business A's real revisionId",
        );

        const documentsB = await readBuilderDocuments(businessB);
        assert.equal(documentsB.length, 0, "the rejected cross-tenant rollback must not create any snapshot for business B");
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    await t.test("parallel rollback against the same target never produces a duplicate document_version", async () => {
      const businessId = await createTestBusiness("parallel-rollback");
      try {
        const draft = await getBusinessBuilderDraft(businessId);
        const v1 = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const edited = withEditedHeroTitle(draft.document, "v2 icerik");
        const saved = await saveBusinessBuilderDraft({ businessId, document: edited, expectedVersion: 1, updatedBy: null });
        await publishBuilderDraft({ businessId, expectedDraftVersion: saved.draftVersion, expectedPublishedVersion: saved.basePublishedVersion });

        const results = await Promise.allSettled([
          rollbackBuilderPublication(businessId, v1.revisionId),
          rollbackBuilderPublication(businessId, v1.revisionId),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const documents = await readBuilderDocuments(businessId);
        const versions = documents.map((d) => d.document_version);
        const uniqueVersions = new Set(versions);

        assert.equal(
          uniqueVersions.size,
          versions.length,
          `document_version values must stay unique per business even under a concurrent rollback race; fulfilled=${fulfilled.length}, versions=${JSON.stringify(versions)}`,
        );
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("Faz 13 regression: rollback then a normal publish never reuse or collide on document_version", async () => {
      const businessId = await createTestBusiness("rollback-then-publish");
      try {
        await getBusinessBuilderDraft(businessId);
        const v1 = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 }); // document_version 2

        const draftAfterV1 = await getBusinessBuilderDraft(businessId);
        const editedV2 = withEditedHeroTitle(draftAfterV1.document, "v2 icerik");
        const savedV2 = await saveBusinessBuilderDraft({ businessId, document: editedV2, expectedVersion: draftAfterV1.draftVersion, updatedBy: null });
        const v2 = await publishBuilderDraft({ businessId, expectedDraftVersion: savedV2.draftVersion, expectedPublishedVersion: savedV2.basePublishedVersion }); // document_version 3

        const rollback = await rollbackBuilderPublication(businessId, v1.revisionId); // document_version 4 (from doc-table max, not from draft)

        const draftAfterRollback = await getBusinessBuilderDraft(businessId);
        assert.equal(
          draftAfterRollback.basePublishedVersion,
          v2.publishedVersion,
          "rollback must not touch the draft's own basePublishedVersion any further (it still thinks v2 is the base, unaware of the rollback)",
        );

        // A normal publish, computed from the draft's own (rollback-unaware)
        // basePublishedVersion (still v2.publishedVersion = 3). Before the
        // Faz 13 fix this would compute document_version = 3 + 1 = 4,
        // COLLIDING with the document_version the rollback above already
        // created (also 4, since it derives from max(document_version)+1).
        const editedV3 = withEditedHeroTitle(draftAfterRollback.document, "v3 gercek publish icerigi");
        const savedV3 = await saveBusinessBuilderDraft({ businessId, document: editedV3, expectedVersion: draftAfterRollback.draftVersion, updatedBy: null });
        const v3 = await publishBuilderDraft({
          businessId,
          expectedDraftVersion: savedV3.draftVersion,
          expectedPublishedVersion: savedV3.basePublishedVersion,
        });

        assert.notEqual(v3.publishedVersion, rollback.publishedVersion, "the fix must prevent this exact collision");
        assert.ok(v3.publishedVersion > rollback.publishedVersion, "a new publish must always move strictly past any version rollback already created");

        const documents = await readBuilderDocuments(businessId);
        const versions = documents.map((d) => d.document_version);
        assert.equal(new Set(versions).size, versions.length, "no duplicate document_version after rollback + publish");
        assert.deepEqual(versions.sort((a, b) => a - b), [2, 3, 4, 5], "versions must strictly increase: v1, v2, rollback, v3");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });
  },
);

// ------------------------------------------------------------
// Faz 15 — repeater (tekrarlanan öğe listesi) çevirileri: Hero Slider'ın
// slaytları, FAQ'in soruları vb. gibi dizi içindeki ögelerin KENDİ
// çevirisini `${sectionId}:${itemId}` bileşik sourceId'siyle yönetmesi.
// ------------------------------------------------------------

function addFaqSectionWithItems(previousDraftDocument, items) {
  const baseState = createInitialBuilderDocumentState();
  const homeId = baseState.draft.workspace.pages[0].id;
  const withFaq = builderDocumentReducer(baseState, { type: "add-block", pageId: homeId, blockKey: asBlockKey("faq") });
  const homePage = withFaq.draft.workspace.pages.find((page) => page.id === homeId);
  const faqSection = homePage.sections.find((section) => section.blockKey === "faq");
  const withItems = builderDocumentReducer(withFaq, {
    type: "update-section-content",
    pageId: homeId,
    sectionId: faqSection.id,
    patch: { items },
  });
  void previousDraftDocument;
  return { document: createBuilderDraftPersistenceRecord(withItems), faqSectionId: faqSection.id };
}

test(
  "website builder repeater (Hero Slider/FAQ item-level) translations — real local Supabase integration",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    await t.test("FAQ item question/answer translated via compound sourceId, round-trips and applies to public render", async () => {
      const businessId = await createTestBusiness("faq-repeater");
      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const { document, faqSectionId } = addFaqSectionWithItems(seeded.document, [
          { id: "faq-item-1", question: "Rezervasyon nasil yapilir?", answer: "Sitemiz uzerinden.", active: true, order: 0 },
          { id: "faq-item-2", question: "Iptal politikasi nedir?", answer: "48 saat once ucretsiz.", active: true, order: 1 },
        ]);

        const saved = await saveBusinessBuilderDraft({ businessId, document, expectedVersion: seeded.draftVersion, updatedBy: null });

        const itemSourceId = `${faqSectionId}:faq-item-1`;
        const { saved: savedTranslations, issues } = await saveBuilderTranslations({
          businessId,
          localeCode: "en",
          entries: [
            { sourceId: itemSourceId, fieldKey: "question", translatedText: "How do I make a reservation?" },
            { sourceId: itemSourceId, fieldKey: "answer", translatedText: "Through our website." },
          ],
        });
        assert.equal(issues.length, 0);
        assert.equal(savedTranslations.length, 2);

        const drafts = await loadBuilderTranslationDrafts(businessId, "en");
        assert.equal(drafts.filter((row) => row.sourceId === itemSourceId).length, 2);

        const published = await publishBuilderDraft({ businessId, expectedDraftVersion: saved.draftVersion, expectedPublishedVersion: saved.basePublishedVersion });
        const resolved = await resolvePublishedBuilderPage(businessId, "home");
        assert.ok(resolved);
        const faqSection = resolved.page.sections.find((section) => section.id === faqSectionId);
        assert.ok(faqSection, "the FAQ section must be present in the published home page");

        const lookup = await resolvePublishedBuilderTranslations(businessId, published.revisionId);
        const applied = applyBuilderSectionTranslations("faq", faqSection.content, faqSection.id, lookup, "en", "tr");

        assert.equal(applied.items[0].question, "How do I make a reservation?");
        assert.equal(applied.items[0].answer, "Through our website.");
        assert.equal(applied.items[1].question, "Iptal politikasi nedir?", "the untranslated second item must fall back to the default locale, unaffected");

        const defaultLocaleDraft = await getBusinessBuilderDraft(businessId);
        const defaultFaq = defaultLocaleDraft.document.workspace.pages
          .find((page) => page.key === "home")
          .sections.find((section) => section.id === faqSectionId);
        assert.equal(defaultFaq.content.items[0].question, "Rezervasyon nasil yapilir?", "the default-locale document itself must never be mutated by an item-level translation");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("Repeater translation write rejects an unknown item id and a cross-tenant compound sourceId", async () => {
      const businessA = await createTestBusiness("faq-repeater-cross-a");
      const businessB = await createTestBusiness("faq-repeater-cross-b");
      try {
        const seededA = await getBusinessBuilderDraft(businessA);
        const { document: documentA, faqSectionId: faqSectionIdA } = addFaqSectionWithItems(seededA.document, [
          { id: "only-in-a", question: "Q", answer: "A", active: true, order: 0 },
        ]);
        await saveBusinessBuilderDraft({ businessId: businessA, document: documentA, expectedVersion: seededA.draftVersion, updatedBy: null });

        const seededB = await getBusinessBuilderDraft(businessB);
        const { document: documentB } = addFaqSectionWithItems(seededB.document, [
          { id: "only-in-b", question: "Q2", answer: "A2", active: true, order: 0 },
        ]);
        await saveBusinessBuilderDraft({ businessId: businessB, document: documentB, expectedVersion: seededB.draftVersion, updatedBy: null });

        const unknownItem = await saveBuilderTranslations({
          businessId: businessA,
          localeCode: "en",
          entries: [{ sourceId: `${faqSectionIdA}:does-not-exist`, fieldKey: "question", translatedText: "x" }],
        });
        assert.equal(unknownItem.saved.length, 0);
        assert.equal(unknownItem.issues.length, 1);

        const crossTenant = await saveBuilderTranslations({
          businessId: businessB,
          localeCode: "en",
          entries: [{ sourceId: `${faqSectionIdA}:only-in-a`, fieldKey: "question", translatedText: "hacked" }],
        });
        assert.equal(crossTenant.saved.length, 0, "business B must never be able to translate business A's FAQ item, even by guessing the compound sourceId");
        assert.equal(crossTenant.issues.length, 1);
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });
  },
);
