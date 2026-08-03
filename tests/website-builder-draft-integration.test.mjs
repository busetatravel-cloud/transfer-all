import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// REAL local Supabase/Postgres integration test — no mocks. Exercises
// draft-store.ts against the local Supabase stack started via
// `supabase start` (127.0.0.1:54321 REST / 54322 Postgres). This file must
// NEVER read `.env.local` (which points at the production project) — the
// local URL/key below are hardcoded so a missing `delete process.env...`
// somewhere can't silently redirect writes at production.
//
// If the local stack is not running, every test in this file is skipped
// (not failed) so `node --test` stays green in environments without Docker.
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

const {
  BuilderDraftConflictError,
  createBusinessBuilderDraft,
  getBusinessBuilderDraft,
  saveBusinessBuilderDraft,
} = jiti("../lib/builder/draft-store.ts");
const { builderDocumentReducer, createBuilderDraftPersistenceRecord, createInitialBuilderDocumentState } = jiti(
  "../lib/builder/document-state.ts",
);

function restHeaders(extra = {}) {
  return {
    apikey: LOCAL_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function restFetch(path, init = {}) {
  return fetch(`${LOCAL_SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: restHeaders(init.headers),
  });
}

async function createTestBusiness(label) {
  const suffix = randomUUID();
  const res = await restFetch("/businesses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: `builder-audit-${label}-${suffix}`,
      email: `builder-audit-${suffix}@example.test`,
      domain: `builder-audit-${suffix}.example.test`,
    }),
  });

  const bodyText = await res.text();
  assert.equal(res.status, 201, `business insert failed: ${bodyText}`);
  const rows = JSON.parse(bodyText);
  return rows[0].id;
}

async function deleteTestBusiness(businessId) {
  await restFetch(`/businesses?id=eq.${businessId}`, { method: "DELETE" });
}

async function readDraftRowsDirect(businessId) {
  const res = await restFetch(`/business_site_builder_drafts?business_id=eq.${businessId}`);
  return res.json();
}

function setLocalEnv() {
  process.env.SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

test(
  "website builder draft — real local Supabase integration",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    await t.test("parallel first-seed race creates exactly one draft row", async () => {
      const businessId = await createTestBusiness("race");

      try {
        const [a, b] = await Promise.all([
          getBusinessBuilderDraft(businessId),
          getBusinessBuilderDraft(businessId),
        ]);

        assert.ok(a && b, "both concurrent GETs must succeed");
        assert.equal(a.id, b.id, "both requests must resolve to the same row");
        assert.equal(a.draftVersion, 1);
        assert.equal(b.draftVersion, 1);

        const rows = await readDraftRowsDirect(businessId);
        assert.equal(rows.length, 1, "exactly one draft row must exist for this business");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("malformed existing row is repaired in place and GET succeeds", async () => {
      const businessId = await createTestBusiness("corrupt");

      try {
        const insertRes = await restFetch("/business_site_builder_drafts", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            business_id: businessId,
            draft_version: 1,
            base_published_version: 1,
            document: { not: "a valid draft document" },
          }),
        });
        assert.equal(insertRes.status, 201);
        const [insertedRow] = await insertRes.json();

        const repaired = await getBusinessBuilderDraft(businessId);

        assert.ok(repaired, "GET must succeed instead of failing forever on a corrupted row");
        assert.equal(repaired.id, insertedRow.id, "repair must reuse the SAME row, not create a new one");
        assert.equal(repaired.draftVersion, 1);
        assert.ok(Array.isArray(repaired.document.workspace.pages) && repaired.document.workspace.pages.length > 0);

        const rows = await readDraftRowsDirect(businessId);
        assert.equal(rows.length, 1, "repair must not create a second row");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("parallel PUT conflict — exactly one of two concurrent saves at the same version wins", async () => {
      const businessId = await createTestBusiness("conflict");

      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const baseState = createInitialBuilderDocumentState();
        const homeId = baseState.draft.workspace.pages[0].id;
        const heroSectionId = baseState.draft.workspace.pages[0].sections[0].id;

        const stateA = builderDocumentReducer(baseState, {
          type: "update-section-content",
          pageId: homeId,
          sectionId: heroSectionId,
          patch: { title: "Kazanan A" },
        });
        const stateB = builderDocumentReducer(baseState, {
          type: "update-section-content",
          pageId: homeId,
          sectionId: heroSectionId,
          patch: { title: "Kazanan B" },
        });

        const documentA = createBuilderDraftPersistenceRecord(stateA);
        const documentB = createBuilderDraftPersistenceRecord(stateB);

        const results = await Promise.allSettled([
          saveBusinessBuilderDraft({
            businessId,
            document: documentA,
            expectedVersion: seeded.draftVersion,
            updatedBy: null,
          }),
          saveBusinessBuilderDraft({
            businessId,
            document: documentB,
            expectedVersion: seeded.draftVersion,
            updatedBy: null,
          }),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        assert.equal(fulfilled.length, 1, "exactly one concurrent save must succeed");
        assert.equal(rejected.length, 1, "exactly one concurrent save must be rejected as a conflict");
        assert.ok(
          rejected[0].reason instanceof BuilderDraftConflictError,
          "the loser must fail with BuilderDraftConflictError, not a generic error",
        );

        const rows = await readDraftRowsDirect(businessId);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].draft_version, seeded.draftVersion + 1, "draft_version must have advanced by exactly 1");

        const winnerTitle = fulfilled[0].value.document.workspace.pages[0].sections[0].content.title;
        assert.ok(
          winnerTitle === "Kazanan A" || winnerTitle === "Kazanan B",
          "stored document must belong to whichever request actually won",
        );
        assert.equal(
          rows[0].document.workspace.pages[0].sections[0].content.title,
          winnerTitle,
          "no silent lost update: the persisted row must match the winner returned to the caller",
        );
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("page metadata (title/description/SEO/layout) survives save -> read unchanged", async () => {
      const businessId = await createTestBusiness("metadata");

      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const baseState = createInitialBuilderDocumentState();
        const homeId = baseState.draft.workspace.pages[0].id;

        const edited = builderDocumentReducer(baseState, {
          type: "update-page",
          pageId: homeId,
          patch: {
            title: "Ozel Ana Sayfa Basligi",
            description: "Bu aciklama kaybolmamali.",
            seoTitleHint: "Ozel SEO basligi",
            seoDescriptionHint: "Ozel SEO aciklamasi",
            containerWidth: "xl",
            backgroundMode: "dark",
            sectionGap: 40,
            topSpacing: 60,
            bottomSpacing: 80,
          },
        });

        const document = createBuilderDraftPersistenceRecord(edited);
        await saveBusinessBuilderDraft({
          businessId,
          document,
          expectedVersion: seeded.draftVersion,
          updatedBy: null,
        });

        const reloaded = await getBusinessBuilderDraft(businessId);
        const homePage = reloaded.document.workspace.pages.find((page) => page.id === homeId);

        assert.equal(homePage.title, "Ozel Ana Sayfa Basligi");
        assert.equal(homePage.description, "Bu aciklama kaybolmamali.");
        assert.equal(homePage.seoTitleHint, "Ozel SEO basligi");
        assert.equal(homePage.seoDescriptionHint, "Ozel SEO aciklamasi");
        assert.equal(homePage.containerWidth, "xl");
        assert.equal(homePage.backgroundMode, "dark");
        assert.equal(homePage.sectionGap, 40);
        assert.equal(homePage.topSpacing, 60);
        assert.equal(homePage.bottomSpacing, 80);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("tenant isolation — saving business A's draft never touches business B's row", async () => {
      const businessA = await createTestBusiness("tenant-a");
      const businessB = await createTestBusiness("tenant-b");

      try {
        const draftA = await getBusinessBuilderDraft(businessA);
        const draftB = await getBusinessBuilderDraft(businessB);

        const baseState = createInitialBuilderDocumentState();
        const homeId = baseState.draft.workspace.pages[0].id;
        const heroSectionId = baseState.draft.workspace.pages[0].sections[0].id;
        const editedA = builderDocumentReducer(baseState, {
          type: "update-section-content",
          pageId: homeId,
          sectionId: heroSectionId,
          patch: { title: "Sadece Tenant A" },
        });

        await saveBusinessBuilderDraft({
          businessId: businessA,
          document: createBuilderDraftPersistenceRecord(editedA),
          expectedVersion: draftA.draftVersion,
          updatedBy: null,
        });

        const reloadedB = await getBusinessBuilderDraft(businessB);
        assert.equal(reloadedB.draftVersion, draftB.draftVersion, "tenant B's version must be untouched");
        assert.equal(
          reloadedB.document.workspace.pages[0].sections[0].content.title,
          draftB.document.workspace.pages[0].sections[0].content.title,
          "tenant B's content must be untouched by tenant A's save",
        );
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    await t.test("adversarial: businessId spoofing field in the document body is ignored by the store layer", async () => {
      const businessId = await createTestBusiness("spoof");

      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const baseState = createInitialBuilderDocumentState();
        const document = createBuilderDraftPersistenceRecord(baseState);

        // draft-store.saveBusinessBuilderDraft takes businessId as an explicit
        // parameter (never read from the document body) — the API route layer
        // is what defends against a spoofed businessId field in the JSON body
        // (see ensureNoBusinessIdSpoofing in the route handler). This proves
        // the store itself always writes to the caller-supplied businessId.
        await saveBusinessBuilderDraft({
          businessId,
          document: { ...document, businessId: "not-a-real-business-id" },
          expectedVersion: seeded.draftVersion,
          updatedBy: null,
        });

        const rows = await readDraftRowsDirect(businessId);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].business_id, businessId);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("adversarial: duplicate page key in an otherwise-valid document is rejected", async () => {
      const businessId = await createTestBusiness("dup-key");

      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const malformed = structuredClone(seeded.document);
        malformed.workspace.pages[1].key = malformed.workspace.pages[0].key;

        await assert.rejects(() =>
          saveBusinessBuilderDraft({
            businessId,
            document: malformed,
            expectedVersion: seeded.draftVersion,
            updatedBy: null,
          }),
        );

        const rows = await readDraftRowsDirect(businessId);
        assert.equal(rows[0].draft_version, 1, "rejected save must not bump the version or persist");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });
  },
);
