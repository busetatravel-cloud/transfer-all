import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true, jsx: true });

// Block registry side-effect imports.
await jiti.import("../lib/builder/blocks/index.ts");

const {
  createInitialWorkspaceState,
  getPageContainerWidthPx,
  getSelectedPage,
  getSelectedSection,
  normalizePageKey,
  validatePageKeyCandidate,
  workspaceReducer,
} = jiti("../lib/builder/workspace-state.ts");

const { asBlockKey, asVariantKey } = jiti("../lib/builder/types.ts");
const { readHref } = jiti("../lib/builder/validation.ts");

function reduce(state, action) {
  return workspaceReducer(state, action);
}

test("website builder workspace flows", async (t) => {
  await t.test("initial workspace has seeded multi-page state", () => {
    const state = createInitialWorkspaceState();

    assert.equal(state.pages.length, 6);
    assert.equal(getSelectedPage(state)?.key, "home");
    assert.equal(getSelectedSection(state)?.position, 0);
  });

  await t.test("block add clone delete toggle and reorder work in memory", () => {
    let state = createInitialWorkspaceState();
    const home = state.pages.find((page) => page.key === "home");

    assert.ok(home, "home page should exist");
    const initialLength = home.sections.length;

    state = reduce(state, {
      type: "add-block",
      pageId: home.id,
      blockKey: asBlockKey("cta"),
    });

    const addedHome = state.pages.find((page) => page.id === home.id);
    assert.ok(addedHome);
    assert.equal(addedHome.sections.length, initialLength + 1);

    const addedSection = addedHome.sections.at(-1);
    assert.ok(addedSection);
    assert.equal(state.selectedSectionByPageId[home.id], addedSection.id);

    state = reduce(state, {
      type: "clone-section",
      pageId: home.id,
      sectionId: addedSection.id,
    });

    const clonedHome = state.pages.find((page) => page.id === home.id);
    assert.ok(clonedHome);
    assert.equal(clonedHome.sections.length, initialLength + 2);
    assert.notEqual(clonedHome.sections.at(-1)?.id, addedSection.id);

    const firstSectionId = clonedHome.sections[0].id;
    state = reduce(state, {
      type: "toggle-section",
      pageId: home.id,
      sectionId: firstSectionId,
    });

    const toggledHome = state.pages.find((page) => page.id === home.id);
    assert.equal(toggledHome?.sections[0].active, false);

    const reorderSource = toggledHome?.sections[0].id;
    const reorderTarget = toggledHome?.sections[1].id;
    assert.ok(reorderSource);
    assert.ok(reorderTarget);

    state = reduce(state, {
      type: "reorder-section",
      pageId: home.id,
      fromId: reorderSource,
      toId: reorderTarget,
    });

    const reorderedHome = state.pages.find((page) => page.id === home.id);
    assert.ok(reorderedHome);
    assert.equal(reorderedHome.sections[1].id, reorderSource);
  });

  await t.test("page selection survives page switching and empty state", () => {
    let state = createInitialWorkspaceState();
    const home = state.pages.find((page) => page.key === "home");
    const contact = state.pages.find((page) => page.key === "contact");

    assert.ok(home);
    assert.ok(contact);

    const homeSelectedSection = state.selectedSectionByPageId[home.id];
    state = reduce(state, { type: "select-page", pageId: contact.id });
    assert.equal(state.selectedPageId, contact.id);

    state = reduce(state, { type: "select-section", pageId: contact.id, sectionId: contact.sections[1].id });
    assert.equal(state.selectedSectionByPageId[contact.id], contact.sections[1].id);

    state = reduce(state, { type: "select-page", pageId: home.id });
    assert.equal(state.selectedSectionByPageId[home.id], homeSelectedSection);

    const homePage = state.pages.find((page) => page.id === home.id);
    assert.ok(homePage);

    for (const section of [...homePage.sections]) {
      state = reduce(state, { type: "delete-section", pageId: home.id, sectionId: section.id });
    }

    const emptyHome = state.pages.find((page) => page.id === home.id);
    assert.ok(emptyHome);
    assert.equal(emptyHome.sections.length, 0);
    assert.equal(state.selectedSectionByPageId[home.id], null);
    assert.equal(getSelectedSection({ ...state, selectedPageId: home.id }), null);
  });

  await t.test("duplicate page key and slug normalization are validated", () => {
    const state = createInitialWorkspaceState();
    const home = state.pages.find((page) => page.key === "home");

    assert.ok(home);
    assert.equal(normalizePageKey("  New Page Key  "), "new-page-key");
    assert.equal(validatePageKeyCandidate(state, home.id, "services").valid, false);
    assert.equal(validatePageKeyCandidate(state, home.id, "").valid, false);
  });

  await t.test("responsive width mapping and href sanitization stay safe", () => {
    assert.equal(getPageContainerWidthPx("full"), "100%");
    assert.equal(getPageContainerWidthPx("xl"), 1360);

    const issues = [];
    const href = readHref("javascript:alert(1)", "/fallback", "content.primaryButtonHref", issues);

    assert.equal(href, "/fallback");
    assert.ok(issues.length > 0);
  });
});
