import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

// Faz 13 SON DUZELTME — dedicated race-condition regression suite for
// rollback_builder_publication. Before this fix, that RPC computed
// document_version via an UNLOCKED "select max(document_version)+1", which
// could let two concurrent rollbacks (or a rollback racing a publish) both
// read the same max and insert colliding document_version values. The fix
// adds a `select ... from business_site_builder_drafts where business_id=...
// for update` lock at the top of the function — the SAME lock source
// publish_builder_draft already used — so any two calls for the same
// business now serialize instead of racing. This file exercises that fix
// under real concurrent load against the real local Postgres instance (no
// mocks), per the explicit request: 10 parallel rollbacks, 5 rollback + 5
// publish mixed load, two tenants rolling back simultaneously, and a
// cross-tenant rejection under concurrent legitimate load. Several of these
// are wrapped in a repeat loop rather than run once, since race conditions
// are inherently probabilistic.
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
const { BuilderPublishConflictError, BuilderRollbackNotFoundError, publishBuilderDraft, rollbackBuilderPublication } =
  jiti("../lib/builder/publish-store.ts");

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
      name: `rollback-race-${label}-${suffix}`,
      email: `rollback-race-${label}-${suffix}@example.test`,
      domain: `rollback-race-${label}-${suffix}.example.test`,
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

async function readRevisions(businessId) {
  const res = await restFetch(`/business_publication_revisions?business_id=eq.${businessId}&order=version.asc`);
  return res.json();
}

function setLocalEnv() {
  process.env.SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function withEditedHeroTitle(previousDocument, title) {
  const workspace = structuredClone(previousDocument.workspace);
  const homePage = workspace.pages.find((page) => page.key === "home");
  const heroSection = homePage.sections.find((section) => section.blockKey === "hero");
  heroSection.content = { ...heroSection.content, title };
  return { version: previousDocument.version, savedAt: new Date().toISOString(), workspace };
}

async function setupTwoVersions(label) {
  const businessId = await createTestBusiness(label);
  await getBusinessBuilderDraft(businessId);
  const v1 = await publishBuilderDraft({ businessId, expectedDraftVersion: 1, expectedPublishedVersion: 1 });

  const draftAfterV1 = await getBusinessBuilderDraft(businessId);
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

  return {
    businessId,
    v1,
    v2,
    savedDraftVersion: saved.draftVersion,
    savedBasePublishedVersion: saved.basePublishedVersion,
  };
}

async function assertNoDuplicateVersions(businessId, context) {
  const documents = await readBuilderDocuments(businessId);
  const versions = documents.map((d) => d.document_version);
  assert.equal(
    new Set(versions).size,
    versions.length,
    `${context}: duplicate document_version found -> ${JSON.stringify(versions)}`,
  );
  return { documents, versions };
}

test(
  "website builder rollback concurrency — race condition regression, real local Supabase integration",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    await t.test(
      "A. 10 parallel rollbacks against the same target -- unique versions, no duplicates, no partial revision rows (5 repeated runs)",
      async () => {
        for (let iteration = 0; iteration < 5; iteration += 1) {
          const { businessId, v1 } = await setupTwoVersions(`10x-rollback-${iteration}`);
          try {
            const results = await Promise.allSettled(
              Array.from({ length: 10 }, () => rollbackBuilderPublication(businessId, v1.revisionId)),
            );

            const fulfilled = results.filter((r) => r.status === "fulfilled");
            assert.ok(fulfilled.length >= 1, `iteration ${iteration}: at least one of 10 parallel rollbacks must succeed`);

            const versionsReturned = fulfilled.map((r) => r.value.publishedVersion);
            assert.equal(
              new Set(versionsReturned).size,
              versionsReturned.length,
              `iteration ${iteration}: every successful rollback must report a unique publishedVersion`,
            );

            const { documents } = await assertNoDuplicateVersions(businessId, `iteration ${iteration}`);
            assert.equal(
              documents.length,
              2 + fulfilled.length,
              `iteration ${iteration}: exactly one document row per successful call, no partial writes`,
            );

            const revisions = await readRevisions(businessId);
            const rollbackRevisions = revisions.filter((r) => r.source === "builder_rollback");
            assert.equal(
              rollbackRevisions.length,
              fulfilled.length,
              `iteration ${iteration}: exactly one revision row per successful rollback, no orphaned revision-without-snapshot`,
            );

            const documentRevisionIds = new Set(documents.map((d) => d.revision_id));
            for (const revision of rollbackRevisions) {
              assert.ok(
                documentRevisionIds.has(revision.id),
                `iteration ${iteration}: revision ${revision.id} has no matching snapshot document (partial write)`,
              );
            }
          } finally {
            await deleteTestBusiness(businessId);
          }
        }
      },
    );

    await t.test(
      "B. 5 parallel rollback + 5 parallel publish on the same business -- no version collision, no partial records (3 repeated runs)",
      async () => {
        for (let iteration = 0; iteration < 3; iteration += 1) {
          const { businessId, v1, v2 } = await setupTwoVersions(`mixed-${iteration}`);
          try {
            // Uses v2's OWN returned versions (post-v2-publish state), not the
            // pre-publish savedDraftVersion/savedBasePublishedVersion — those
            // became stale the instant v2's own publish call succeeded and
            // advanced basePublishedVersion, which would make every one of
            // these 5 publishes conflict spuriously (a test bug, not a real
            // app bug, caught by re-running this suite before shipping it).
            const calls = [
              ...Array.from({ length: 5 }, () => rollbackBuilderPublication(businessId, v1.revisionId)),
              ...Array.from({ length: 5 }, () =>
                publishBuilderDraft({
                  businessId,
                  expectedDraftVersion: v2.draftVersion,
                  expectedPublishedVersion: v2.publishedVersion,
                }),
              ),
            ];

            const results = await Promise.allSettled(calls);
            const rollbackResults = results.slice(0, 5);
            const publishResults = results.slice(5);

            const rollbackFulfilled = rollbackResults.filter((r) => r.status === "fulfilled");
            const publishFulfilled = publishResults.filter((r) => r.status === "fulfilled");
            const publishRejected = publishResults.filter((r) => r.status === "rejected");

            assert.equal(
              rollbackFulfilled.length,
              5,
              `iteration ${iteration}: rollback has no optimistic-lock guard by design -- all 5 must succeed once serialized by the row lock`,
            );
            assert.equal(
              publishFulfilled.length,
              1,
              `iteration ${iteration}: exactly one of 5 identical-expected-version publishes may win the optimistic lock`,
            );
            assert.equal(publishRejected.length, 4);
            for (const rejected of publishRejected) {
              assert.ok(
                rejected.reason instanceof BuilderPublishConflictError,
                `iteration ${iteration}: losing publishes must fail as a conflict, not a generic/transaction error`,
              );
            }

            const { documents } = await assertNoDuplicateVersions(businessId, `iteration ${iteration} mixed load`);
            assert.equal(
              documents.length,
              2 + rollbackFulfilled.length + publishFulfilled.length,
              `iteration ${iteration}: exactly one document per successful call, none missing or duplicated`,
            );
          } finally {
            await deleteTestBusiness(businessId);
          }
        }
      },
    );

    await t.test("C. Two tenants rollback simultaneously -- no cross-blocking, no cross-tenant contamination", async () => {
      const { businessId: businessA, v1: v1A } = await setupTwoVersions("two-tenant-a");
      const { businessId: businessB, v1: v1B } = await setupTwoVersions("two-tenant-b");
      try {
        const [resultA, resultB] = await Promise.all([
          rollbackBuilderPublication(businessA, v1A.revisionId),
          rollbackBuilderPublication(businessB, v1B.revisionId),
        ]);

        assert.ok(resultA.revisionId);
        assert.ok(resultB.revisionId);
        assert.notEqual(resultA.revisionId, resultB.revisionId);

        const documentsA = await readBuilderDocuments(businessA);
        const documentsB = await readBuilderDocuments(businessB);

        assert.equal(documentsA.length, 3, "business A must have exactly its own 3 documents (v1, v2, rollback)");
        assert.equal(documentsB.length, 3, "business B must have exactly its own 3 documents (v1, v2, rollback)");
        assert.ok(documentsA.every((d) => d.business_id === businessA), "no business B rows leaked into business A's result set");
        assert.ok(documentsB.every((d) => d.business_id === businessB), "no business A rows leaked into business B's result set");
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });

    await t.test("D. Cross-tenant targetRevisionId is rejected even under concurrent legitimate load", async () => {
      const { businessId: businessA, v1: v1A } = await setupTwoVersions("cross-target-a");
      const businessB = await createTestBusiness("cross-target-b");
      try {
        await getBusinessBuilderDraft(businessB);

        const results = await Promise.allSettled([
          rollbackBuilderPublication(businessA, v1A.revisionId), // legitimate: own revision
          rollbackBuilderPublication(businessB, v1A.revisionId), // illegitimate: business A's revision
        ]);

        assert.equal(results[0].status, "fulfilled", "business A's own legitimate concurrent rollback must still succeed");
        assert.equal(results[1].status, "rejected");
        assert.ok(results[1].reason instanceof BuilderRollbackNotFoundError);

        const documentsB = await readBuilderDocuments(businessB);
        assert.equal(documentsB.length, 0, "the rejected cross-tenant attempt must not create anything for business B");
      } finally {
        await deleteTestBusiness(businessA);
        await deleteTestBusiness(businessB);
      }
    });
  },
);
