import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// draft-store.ts (and supabase-config.ts) import "server-only" as a real
// production safety boundary. That specifier only resolves inside Next's
// bundler; under a plain `node --test` run it must be aliased to a no-op.
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
  BuilderDraftValidationError,
  createBusinessBuilderDraft,
  getBusinessBuilderDraft,
  saveBusinessBuilderDraft,
  validateBuilderDraftDocument,
} = jiti("../lib/builder/draft-store.ts");

const { createBuilderDraftPersistenceRecord, createInitialBuilderDocumentState } = jiti("../lib/builder/document-state.ts");

function createDraftResponse(record, init = {}) {
  return new Response(JSON.stringify(record), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createEmptyResponse(status = 200) {
  return new Response("[]", {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetchMock(routes) {
  const calls = [];
  const originalFetch = global.fetch;

  global.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    const method = String(init.method ?? "GET").toUpperCase();
    calls.push({ url, method, body: init.body ?? null, headers: init.headers ?? {} });

    const route = routes.find((entry) => entry.method === method && url.includes(entry.match));
    if (!route) {
      throw new Error(`Unexpected fetch call: ${method} ${url}`);
    }

    return typeof route.response === "function"
      ? route.response({ url, method, body: init.body ?? null, headers: init.headers ?? {} })
      : route.response;
  };

  return {
    calls,
    restore() {
      global.fetch = originalFetch;
    },
  };
}

function setSupabaseEnv() {
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
}

test("website builder draft persistence", async (t) => {
  const state = createInitialBuilderDocumentState();
  const homeId = state.draft.workspace.pages[0].id;

  await t.test("getBusinessBuilderDraft seeds a draft when none exists", async () => {
    setSupabaseEnv();

    const seededRecord = createBuilderDraftPersistenceRecord(state, "2026-08-03T12:00:00.000Z");
    const fetchMock = installFetchMock([
      {
        method: "GET",
        match: "/business_site_builder_drafts?select=",
        response: createEmptyResponse(),
      },
      {
        method: "POST",
        match: "/business_site_builder_drafts",
        response: createDraftResponse({
          id: "draft-1",
          business_id: "business-1",
          draft_version: 1,
          base_published_version: 1,
          document: seededRecord,
          created_at: "2026-08-03T12:00:00.000Z",
          updated_at: "2026-08-03T12:00:00.000Z",
          updated_by: null,
        }),
      },
    ]);

    const draft = await getBusinessBuilderDraft("business-1");
    fetchMock.restore();

    assert.ok(draft);
    assert.equal(draft.businessId, "business-1");
    assert.equal(draft.draftVersion, 1);
    assert.equal(draft.document.workspace.pages[0].title, state.draft.workspace.pages[0].title);
    assert.equal(fetchMock.calls[0].method, "GET");
    assert.equal(fetchMock.calls[1].method, "POST");
  });

  await t.test("saveBusinessBuilderDraft increments version with optimistic locking", async () => {
    setSupabaseEnv();

      let mutatedState = state;
      mutatedState = jiti("../lib/builder/document-state.ts").builderDocumentReducer(mutatedState, {
      type: "update-section-content",
      pageId: homeId,
      sectionId: state.draft.workspace.pages[0].sections[0].id,
      patch: { title: "Sunucu Taslagi" },
    });

    const saveRecord = createBuilderDraftPersistenceRecord(mutatedState, "2026-08-03T12:05:00.000Z");
    const fetchMock = installFetchMock([
      {
        method: "GET",
        match: "/business_site_builder_drafts?select=",
        response: createDraftResponse({
          id: "draft-1",
          business_id: "business-1",
          draft_version: 1,
          base_published_version: 1,
          document: createBuilderDraftPersistenceRecord(state, "2026-08-03T12:00:00.000Z"),
          created_at: "2026-08-03T12:00:00.000Z",
          updated_at: "2026-08-03T12:00:00.000Z",
          updated_by: null,
        }),
      },
      {
        method: "PATCH",
        match: "/business_site_builder_drafts?business_id=eq.business-1&draft_version=eq.1",
        response: createDraftResponse({
          id: "draft-1",
          business_id: "business-1",
          draft_version: 2,
          base_published_version: 1,
          document: saveRecord,
          created_at: "2026-08-03T12:00:00.000Z",
          updated_at: "2026-08-03T12:05:00.000Z",
          updated_by: "user-1",
        }),
      },
    ]);

    const saved = await saveBusinessBuilderDraft({
      businessId: "business-1",
      document: saveRecord,
      expectedVersion: 1,
      updatedBy: "user-1",
    });
    fetchMock.restore();

    assert.equal(saved.draftVersion, 2);
    assert.equal(saved.document.version.draft, 2);
    assert.equal(saved.document.workspace.pages[0].sections[0].content.title, "Sunucu Taslagi");
    assert.equal(fetchMock.calls[1].method, "PATCH");
    assert.ok(String(fetchMock.calls[1].url).includes("draft_version=eq.1"));
  });

  await t.test("stale save requests fail with conflict", async () => {
    setSupabaseEnv();

    const fetchMock = installFetchMock([
      {
        method: "GET",
        match: "/business_site_builder_drafts?select=",
        response: createDraftResponse({
          id: "draft-1",
          business_id: "business-1",
          draft_version: 2,
          base_published_version: 1,
          document: createBuilderDraftPersistenceRecord(state, "2026-08-03T12:10:00.000Z"),
          created_at: "2026-08-03T12:00:00.000Z",
          updated_at: "2026-08-03T12:10:00.000Z",
          updated_by: "user-2",
        }),
      },
    ]);

    await assert.rejects(
      () =>
        saveBusinessBuilderDraft({
          businessId: "business-1",
          document: createBuilderDraftPersistenceRecord(state, "2026-08-03T12:05:00.000Z"),
          expectedVersion: 1,
          updatedBy: "user-1",
        }),
      BuilderDraftConflictError,
    );

    fetchMock.restore();
  });

  await t.test("invalid documents are rejected before save", () => {
    const validation = validateBuilderDraftDocument({
      version: { draft: 1, published: 1, saved: 1 },
      savedAt: "2026-08-03T12:00:00.000Z",
      workspace: {
        pages: [
          {
            id: "page-home",
            key: "home",
            title: "Home",
            description: "",
            seoTitleHint: "",
            seoDescriptionHint: "",
            isSystemPage: true,
            active: true,
            containerWidth: "lg",
            backgroundMode: "light",
            sectionGap: 24,
            topSpacing: 24,
            bottomSpacing: 40,
            sections: [],
          },
          {
            id: "page-home-copy",
            key: "home",
            title: "Duplicate",
            description: "",
            seoTitleHint: "",
            seoDescriptionHint: "",
            isSystemPage: false,
            active: true,
            containerWidth: "lg",
            backgroundMode: "light",
            sectionGap: 24,
            topSpacing: 24,
            bottomSpacing: 40,
            sections: [],
          },
        ],
        selectedPageId: "page-home",
        selectedSectionByPageId: {},
      },
    });

    assert.equal(validation.valid, false);
    assert.ok(validation.issues.length > 0);
  });

  await t.test("valid page metadata is preserved, not overwritten with placeholders", () => {
    const validation = validateBuilderDraftDocument({
      version: { draft: 1, published: 1, saved: 1 },
      savedAt: "2026-08-03T12:00:00.000Z",
      workspace: {
        pages: [
          {
            id: "page-home",
            key: "home",
            title: "Musteri Karsilama",
            description: "Ozel bir aciklama.",
            seoTitleHint: "Ozel SEO basligi",
            seoDescriptionHint: "Ozel SEO aciklamasi",
            isSystemPage: true,
            active: false,
            containerWidth: "full",
            backgroundMode: "dark",
            sectionGap: 32,
            topSpacing: 12,
            bottomSpacing: 96,
            sections: [],
          },
        ],
        selectedPageId: "page-home",
        selectedSectionByPageId: {},
      },
    });

    assert.equal(validation.valid, true);
    const page = validation.document.workspace.pages[0];
    assert.equal(page.title, "Musteri Karsilama");
    assert.equal(page.description, "Ozel bir aciklama.");
    assert.equal(page.seoTitleHint, "Ozel SEO basligi");
    assert.equal(page.seoDescriptionHint, "Ozel SEO aciklamasi");
    assert.equal(page.active, false);
    assert.equal(page.containerWidth, "full");
    assert.equal(page.backgroundMode, "dark");
    assert.equal(page.sectionGap, 32);
    assert.equal(page.topSpacing, 12);
    assert.equal(page.bottomSpacing, 96);
  });

  await t.test("a non-system page cannot claim a reserved system page key", () => {
    const validation = validateBuilderDraftDocument({
      version: { draft: 1, published: 1, saved: 1 },
      savedAt: "2026-08-03T12:00:00.000Z",
      workspace: {
        pages: [
          {
            id: "page-custom-1",
            key: "home",
            title: "Sahte Home",
            description: "",
            seoTitleHint: "",
            seoDescriptionHint: "",
            isSystemPage: false,
            active: true,
            containerWidth: "lg",
            backgroundMode: "light",
            sectionGap: 24,
            topSpacing: 24,
            bottomSpacing: 40,
            sections: [],
          },
        ],
        selectedPageId: "page-custom-1",
        selectedSectionByPageId: {},
      },
    });

    assert.equal(validation.valid, false);
    assert.ok(
      validation.issues.some((issue) => issue.message.includes("Rezerv sayfa anahtari")),
      "reserved key attempt must be rejected even though the client claims isSystemPage=false",
    );
  });

  await t.test("stale selection state is self-healed, not treated as a validation error", () => {
    const validation = validateBuilderDraftDocument({
      version: { draft: 1, published: 1, saved: 1 },
      savedAt: "2026-08-03T12:00:00.000Z",
      workspace: {
        pages: [
          {
            id: "page-home",
            key: "home",
            title: "Home",
            description: "",
            seoTitleHint: "",
            seoDescriptionHint: "",
            isSystemPage: true,
            active: true,
            containerWidth: "lg",
            backgroundMode: "light",
            sectionGap: 24,
            topSpacing: 24,
            bottomSpacing: 40,
            sections: [],
          },
        ],
        selectedPageId: "page-that-no-longer-exists",
        selectedSectionByPageId: { "page-home": "section-that-no-longer-exists" },
      },
    });

    assert.equal(validation.valid, true, "a stale selection reference must not block an otherwise-valid save");
    assert.equal(validation.document.workspace.selectedPageId, "page-home");
    assert.equal(validation.document.workspace.selectedSectionByPageId["page-home"], null);
  });
});
