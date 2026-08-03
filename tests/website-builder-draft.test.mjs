import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, jsx: true });

await jiti.import("../lib/builder/blocks/index.ts");

const {
  builderDocumentReducer,
  canAutosave,
  createInitialBuilderDocumentState,
  getDraftVersionLabel,
  getPublishedVersionLabel,
  getUnsavedChangesNotice,
} = jiti("../lib/builder/document-state.ts");

const { asBlockKey } = jiti("../lib/builder/types.ts");

function reduce(state, action) {
  return builderDocumentReducer(state, action);
}

test("builder draft document state", async (t) => {
  await t.test("draft and published snapshots start separated", () => {
    const state = createInitialBuilderDocumentState();

    assert.equal(getDraftVersionLabel(state), "v1");
    assert.equal(getPublishedVersionLabel(state), "v1");
    assert.equal(state.draft.dirty, false);
    assert.equal(canAutosave(state), false);
    assert.equal(getUnsavedChangesNotice(state), null);
    assert.notStrictEqual(state.draft.workspace.pages, state.published.workspace.pages);
  });

  await t.test("draft mutations do not touch published snapshot", () => {
    const state = createInitialBuilderDocumentState();
    const homeId = state.draft.workspace.pages[0].id;
    const publishedBefore = state.published.workspace.pages.map((page) => page.sections.length);

    const next = reduce(state, {
      type: "add-block",
      pageId: homeId,
      blockKey: asBlockKey("cta"),
    });

    assert.equal(next.draft.dirty, true);
    assert.equal(next.draft.version.draft, 2);
    assert.equal(next.published.version, 1);
    assert.deepEqual(next.published.workspace.pages.map((page) => page.sections.length), publishedBefore);
    assert.equal(
      getUnsavedChangesNotice(next),
      "Kaydedilmemis degisiklikler var. Kaydetmeden cikarsan son manual kayit geri gelir.",
    );
  });

  await t.test("selection changes stay out of dirty tracking", () => {
    const state = createInitialBuilderDocumentState();
    const homeId = state.draft.workspace.pages[0].id;
    const otherPageId = state.draft.workspace.pages[1].id;

    const next = reduce(state, { type: "select-page", pageId: otherPageId });

    assert.equal(next.draft.workspace.selectedPageId, otherPageId);
    assert.equal(next.draft.version.draft, 1);
    assert.equal(next.draft.dirty, false);

    const selected = reduce(next, {
      type: "select-section",
      pageId: homeId,
      sectionId: next.draft.workspace.pages[0].sections[1].id,
    });

    assert.equal(selected.draft.version.draft, 1);
    assert.equal(selected.draft.dirty, false);
  });

  await t.test("undo can return the draft to a clean published match", () => {
    let state = createInitialBuilderDocumentState();
    const homeId = state.draft.workspace.pages[0].id;

    state = reduce(state, {
      type: "update-page",
      pageId: homeId,
      patch: { title: "Yeni Baslik" },
    });
    assert.equal(state.draft.dirty, true);

    state = reduce(state, { type: "undo" });
    assert.equal(state.draft.dirty, false);
    assert.equal(state.published.version, 1);
  });
});
