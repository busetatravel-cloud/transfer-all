import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// REAL local Supabase/Postgres integration test for the Faz 10 publish
// pipeline — no mocks. Exercises publish-store.ts (which calls the
// publish_builder_draft / rollback_builder_publication Postgres RPCs)
// against the local Supabase stack (127.0.0.1:54321 REST / 54322 Postgres).
// Never reads `.env.local` (production project) — local URL/key are
// hardcoded here, same as website-builder-draft-integration.test.mjs.
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

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
const { builderDocumentReducer, createBuilderDraftPersistenceRecord, createInitialBuilderDocumentState } = jiti(
  "../lib/builder/document-state.ts",
);
const {
  BuilderPublishConflictError,
  BuilderPublishNotFoundError,
  BuilderPublishValidationError,
  BuilderRollbackNotFoundError,
  getBuilderPublicationVersion,
  getLatestPublishedBuilderDocument,
  getPublishedBuilderDocument,
  listBuilderPublicationVersions,
  publishBuilderDraft,
  rollbackBuilderPublication,
} = jiti("../lib/builder/publish-store.ts");

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
      name: `publish-audit-${label}-${suffix}`,
      email: `publish-audit-${suffix}@example.test`,
      domain: `publish-audit-${suffix}.example.test`,
    }),
  });
  const bodyText = await res.text();
  assert.equal(res.status, 201, `business insert failed: ${bodyText}`);
  return JSON.parse(bodyText)[0].id;
}

async function deleteTestBusiness(businessId) {
  await restFetch(`/businesses?id=eq.${businessId}`, { method: "DELETE" });
}

async function readRevisions(businessId) {
  const res = await restFetch(`/business_publication_revisions?business_id=eq.${businessId}&order=version.asc`);
  return res.json();
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

function editHomeTitle(title) {
  const baseState = createInitialBuilderDocumentState();
  const homeId = baseState.draft.workspace.pages[0].id;
  const heroSectionId = baseState.draft.workspace.pages[0].sections[0].id;
  const edited = builderDocumentReducer(baseState, {
    type: "update-section-content",
    pageId: homeId,
    sectionId: heroSectionId,
    patch: { title },
  });
  return createBuilderDraftPersistenceRecord(edited);
}

test(
  "website builder publish — real local Supabase integration",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    await t.test("publish is rejected when no draft exists yet", async () => {
      const businessId = await createTestBusiness("no-draft");
      try {
        await assert.rejects(
          () => publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 }),
          BuilderPublishNotFoundError,
        );

        const revisions = await readRevisions(businessId);
        const documents = await readBuilderDocuments(businessId);
        assert.equal(revisions.length, 0, "a rejected publish must not create a revision");
        assert.equal(documents.length, 0, "a rejected publish must not create a snapshot");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("valid draft publishes: revision + snapshot created, draft baseline updated, draft preserved", async () => {
      const businessId = await createTestBusiness("valid");
      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        assert.equal(seeded.draftVersion, 1);
        assert.equal(seeded.basePublishedVersion, 1);

        const result = await publishBuilderDraft({
          businessId,
          expectedDraftVersion: 1,
          expectedPublishedVersion: 1,
        });

        // basePublishedVersion starts at 1 ("nothing published yet") and the
        // FIRST publish must move it to 2 — it deliberately never returns to
        // the same "1" that meant "unpublished", otherwise a second parallel
        // first-publish attempt could not tell it was too late (see the
        // parallel-publish-conflict test below, which is exactly what this
        // numbering exists to make detectable).
        assert.equal(result.publishedVersion, 2);
        assert.equal(result.draftVersion, 1, "publish must not bump draftVersion");
        assert.ok(result.revisionId);
        assert.ok(result.publishedAt);

        const revisions = await readRevisions(businessId);
        assert.equal(revisions.length, 1);
        assert.equal(revisions[0].source, "builder");
        assert.equal(revisions[0].status, "preview", "builder revisions must never claim status=published (would break legacy public-site lookup)");
        assert.equal(revisions[0].version, 1, "the shared ledger version is independent of the builder-local published version");

        const documents = await readBuilderDocuments(businessId);
        assert.equal(documents.length, 1);
        assert.equal(documents[0].revision_id, result.revisionId);
        assert.equal(documents[0].document_version, 2);
        assert.deepEqual(documents[0].document.workspace.pages[0].id, seeded.document.workspace.pages[0].id);

        const reloadedDraft = await getBusinessBuilderDraft(businessId);
        assert.equal(reloadedDraft.draftVersion, 1, "draft content/version must be untouched by publish");
        assert.equal(reloadedDraft.basePublishedVersion, 2, "basePublishedVersion must now equal the new published version");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("editing and saving the draft after publish does not change the published snapshot", async () => {
      const businessId = await createTestBusiness("post-publish-edit");
      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const editedDocument = editHomeTitle("Yayından SONRA yapılan değişiklik");
        const saved = await saveBusinessBuilderDraft({
          businessId,
          document: editedDocument,
          expectedVersion: 1,
          updatedBy: null,
        });
        assert.equal(saved.draftVersion, 2);
        assert.equal(saved.basePublishedVersion, 2, "saving must not touch the published baseline");

        const publishedDoc = await getLatestPublishedBuilderDocument(businessId);
        assert.notEqual(
          publishedDoc.workspace.pages[0].sections[0].content.title,
          "Yayından SONRA yapılan değişiklik",
          "the already-published snapshot must be immutable — later draft edits must not leak into it",
        );

        void seeded;
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("stale draft version is rejected as a draft_conflict", async () => {
      const businessId = await createTestBusiness("stale-draft");
      try {
        await getBusinessBuilderDraft(businessId);
        const editedDocument = editHomeTitle("v2 icerik");
        await saveBusinessBuilderDraft({ businessId, document: editedDocument, expectedVersion: 1, updatedBy: null });

        await assert.rejects(
          async () => {
            try {
              await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });
            } catch (error) {
              assert.ok(error instanceof BuilderPublishConflictError);
              assert.equal(error.kind, "draft");
              assert.equal(error.currentDraftVersion, 2);
              throw error;
            }
          },
          BuilderPublishConflictError,
        );

        const revisions = await readRevisions(businessId);
        assert.equal(revisions.length, 0, "a stale-version publish attempt must not create a revision");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("stale published version is rejected as a published_conflict", async () => {
      const businessId = await createTestBusiness("stale-published");
      try {
        await getBusinessBuilderDraft(businessId);
        await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        await assert.rejects(
          async () => {
            try {
              // draftVersion (1) hala dogru ama basePublishedVersion artik 2
              // (bir onceki publish 1'den 2'ye tasidi) — yanlislikla eski
              // expectedPublishedVersion=1 gonderiyoruz.
              await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });
            } catch (error) {
              assert.ok(error instanceof BuilderPublishConflictError);
              assert.equal(error.kind, "published");
              assert.equal(error.currentPublishedVersion, 2);
              throw error;
            }
          },
          BuilderPublishConflictError,
        );

        const revisions = await readRevisions(businessId);
        assert.equal(revisions.length, 1, "a rejected re-publish attempt must not create a second revision");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("malformed draft is rejected with a validation error, not published", async () => {
      const businessId = await createTestBusiness("malformed");
      try {
        await restFetch("/business_site_builder_drafts", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            business_id: businessId,
            draft_version: 1,
            base_published_version: 1,
            document: { not: "a valid draft document" },
          }),
        });

        await assert.rejects(
          () => publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 }),
          BuilderPublishValidationError,
        );

        const revisions = await readRevisions(businessId);
        const documents = await readBuilderDocuments(businessId);
        assert.equal(revisions.length, 0);
        assert.equal(documents.length, 0);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("parallel publish conflict — exactly one of two concurrent publishes wins, one revision only", async () => {
      const businessId = await createTestBusiness("parallel-publish");
      try {
        await getBusinessBuilderDraft(businessId);

        const results = await Promise.allSettled([
          publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 }),
          publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 }),
        ]);

        const fulfilled = results.filter((r) => r.status === "fulfilled");
        const rejected = results.filter((r) => r.status === "rejected");

        assert.equal(fulfilled.length, 1, "exactly one concurrent publish must succeed");
        assert.equal(rejected.length, 1, "exactly one concurrent publish must be rejected");
        assert.ok(rejected[0].reason instanceof BuilderPublishConflictError);

        const revisions = await readRevisions(businessId);
        const documents = await readBuilderDocuments(businessId);
        assert.equal(revisions.length, 1, "only one revision must be created despite two parallel attempts");
        assert.equal(documents.length, 1, "only one snapshot must be created despite two parallel attempts");
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("tenant isolation — publishing business A never affects business B", async () => {
      const businessA = await createTestBusiness("tenant-a");
      const businessB = await createTestBusiness("tenant-b");
      try {
        await getBusinessBuilderDraft(businessA);
        await getBusinessBuilderDraft(businessB);

        await publishBuilderDraft({ businessId: businessA, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const revisionsB = await readRevisions(businessB);
        const documentsB = await readBuilderDocuments(businessB);
        assert.equal(revisionsB.length, 0, "business B must have zero revisions after business A publishes");
        assert.equal(documentsB.length, 0, "business B must have zero snapshots after business A publishes");

        const draftB = await getBusinessBuilderDraft(businessB);
        assert.equal(draftB.basePublishedVersion, 1, "business B's draft baseline must be untouched");
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    await t.test("anon key cannot call the publish RPC directly (PostgREST-level lockdown)", async () => {
      const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/rpc/publish_builder_draft`, {
        method: "POST",
        headers: {
          apikey: LOCAL_ANON_KEY,
          Authorization: `Bearer ${LOCAL_ANON_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_business_id: "00000000-0000-0000-0000-000000000000",
          p_expected_draft_version: 1,
          p_expected_published_version: 1,
        }),
      });

      assert.equal(res.status, 401, "anon must never be able to invoke the publish RPC");
      const body = await res.json();
      assert.match(body.message, /permission denied/i);
    });

    await t.test("read layer: getPublishedBuilderDocument / getBuilderPublicationVersion / listBuilderPublicationVersions", async () => {
      const businessId = await createTestBusiness("read-layer");
      try {
        assert.equal(await getLatestPublishedBuilderDocument(businessId), null, "no publish yet -> null, never falls back to draft");

        await getBusinessBuilderDraft(businessId);
        const first = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const edited = editHomeTitle("ikinci yayin icerigi");
        await saveBusinessBuilderDraft({ businessId, document: edited, expectedVersion: 1, updatedBy: null });
        const second = await publishBuilderDraft({
          businessId,
          expectedDraftVersion: 2,
          expectedPublishedVersion: first.publishedVersion,
        });

        const latest = await getLatestPublishedBuilderDocument(businessId);
        assert.equal(latest.workspace.pages[0].sections[0].content.title, "ikinci yayin icerigi");

        const byRevision = await getPublishedBuilderDocument(businessId, first.revisionId);
        assert.notEqual(byRevision.workspace.pages[0].sections[0].content.title, "ikinci yayin icerigi");

        const byVersion = await getBuilderPublicationVersion(businessId, first.publishedVersion);
        assert.deepEqual(byVersion, byRevision);

        const versions = await listBuilderPublicationVersions(businessId);
        assert.equal(versions.length, 2);
        assert.equal(versions[0].version, second.publishedVersion);
        assert.equal(versions[0].isActive, true);
        assert.equal(versions[1].isActive, false);
        assert.ok(versions.every((v) => v.source === "builder"));
      } finally {
        await deleteTestBusiness(businessId);
      }
    });

    await t.test("rollback copies an old snapshot forward as a NEW revision without touching the draft", async () => {
      const businessId = await createTestBusiness("rollback");
      try {
        await getBusinessBuilderDraft(businessId);
        const v1 = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

        const edited = editHomeTitle("v2 rollback testi icerigi");
        await saveBusinessBuilderDraft({ businessId, document: edited, expectedVersion: 1, updatedBy: null });
        const v2 = await publishBuilderDraft({
          businessId,
          expectedDraftVersion: 2,
          expectedPublishedVersion: v1.publishedVersion,
        });

        const draftBeforeRollback = await getBusinessBuilderDraft(businessId);

        const rollback = await rollbackBuilderPublication(businessId, v1.revisionId);
        assert.equal(
          rollback.publishedVersion,
          v2.publishedVersion + 1,
          "rollback must create a brand new version, never reuse an old one",
        );

        const rolledBackDoc = await getLatestPublishedBuilderDocument(businessId);
        assert.notEqual(rolledBackDoc.workspace.pages[0].sections[0].content.title, "v2 rollback testi icerigi");

        const revisions = await readRevisions(businessId);
        assert.equal(revisions.length, 3);
        assert.equal(revisions[2].source, "builder_rollback");

        const draftAfterRollback = await getBusinessBuilderDraft(businessId);
        assert.deepEqual(
          draftAfterRollback.document,
          draftBeforeRollback.document,
          "rollback must never mutate the draft",
        );

        await assert.rejects(
          () => rollbackBuilderPublication(businessId, "00000000-0000-0000-0000-000000000000"),
          BuilderRollbackNotFoundError,
        );
      } finally {
        await deleteTestBusiness(businessId);
      }
    });
  },
);
