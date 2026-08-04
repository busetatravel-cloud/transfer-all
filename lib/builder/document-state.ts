import {
  createInitialWorkspaceState,
  createWorkspaceStateFromSnapshot,
  snapshotWorkspaceState,
  workspaceReducer,
  type WorkspaceAction,
  type WorkspacePage,
  type WorkspaceSnapshot,
  type WorkspaceNotice,
  type WorkspaceState,
} from "@/lib/builder/workspace-state";

export interface BuilderAutosaveState {
  enabled: false;
  intervalMs: number;
  queued: boolean;
  lastScheduledAt: string | null;
  lastAttemptAt: string | null;
}

export interface BuilderVersionState {
  draft: number;
  published: number;
  saved: number;
}

export interface BuilderPublishedDocument {
  version: number;
  publishedAt: string | null;
  workspace: WorkspaceSnapshot;
}

export interface BuilderDraftCheckpoint {
  version: number;
  savedAt: string | null;
  workspace: WorkspaceSnapshot;
}

export interface BuilderDraftDocument {
  workspace: WorkspaceState;
  checkpoint: BuilderDraftCheckpoint;
  version: BuilderVersionState;
  dirty: boolean;
  lastEditedAt: string | null;
  autosave: BuilderAutosaveState;
}

export interface BuilderDocumentState {
  published: BuilderPublishedDocument;
  draft: BuilderDraftDocument;
  notice: WorkspaceNotice | null;
}

export interface BuilderDraftPersistenceRecord {
  version: BuilderVersionState;
  savedAt: string;
  workspace: WorkspaceSnapshot;
}

export type BuilderDocumentAction =
  | WorkspaceAction
  | { type: "hydrate-draft"; payload: BuilderDraftPersistenceRecord }
  | { type: "mark-draft-saved"; savedAt?: string; version?: number }
  | { type: "mark-draft-published"; publishedVersion: number; publishedAt: string }
  | { type: "discard-draft" }
  | { type: "reset-draft-to-published" };

const DEFAULT_AUTOSAVE_INTERVAL_MS = 15_000;
const DRAFT_STORAGE_KEY = "transfer-all:website-builder:draft:v1";
const MUTATING_WORKSPACE_ACTIONS = new Set<WorkspaceAction["type"]>([
  "add-block",
  "clone-section",
  "delete-section",
  "toggle-section",
  "move-section",
  "reorder-section",
  "update-section-content",
  "update-section-style",
  "update-section-variant",
  "update-page",
  "undo",
  "redo",
]);

export function createInitialBuilderDocumentState(): BuilderDocumentState {
  const workspace = createInitialWorkspaceState();
  const published = snapshotWorkspace(workspace);

  return {
    published: {
      version: 1,
      publishedAt: null,
      workspace: published,
    },
    draft: {
      workspace,
      checkpoint: {
        version: 1,
        savedAt: null,
        workspace: published,
      },
      version: {
        draft: 1,
        published: 1,
        saved: 1,
      },
      dirty: false,
      lastEditedAt: null,
      autosave: createAutosaveState(),
    },
    notice: null,
  };
}

export function hydrateBuilderDocumentState(
  state: BuilderDocumentState,
  payload: BuilderDraftPersistenceRecord,
): BuilderDocumentState {
  const workspace = createWorkspaceStateFromSnapshot(payload.workspace);

  return {
      ...state,
      notice: {
        tone: "info",
        text: "Sunucudaki kayitli draft geri yuklendi.",
      },
    // payload.version.published, draft satirinin gercek base_published_version'idir
    // (draft-store.ts, mapDraftRow icinde bunu doldurur). Onceden burasi
    // state.published.version'i (hic guncellenmeyen, hep 1 kalan bir client-only
    // deger) kullaniyordu — bu yuzden "Yayında vX" rozeti asla dogru degeri
    // gostermiyordu. Artik published.version de bu gercek deger ile senkronlanir.
    published: {
      ...state.published,
      version: payload.version.published,
    },
    draft: {
      ...state.draft,
      workspace,
      checkpoint: {
        version: payload.version.saved,
        savedAt: payload.savedAt,
        workspace: structuredClone(payload.workspace),
      },
      version: {
        draft: payload.version.draft,
        published: payload.version.published,
        saved: payload.version.saved,
      },
      dirty: false,
      lastEditedAt: null,
      autosave: {
        ...state.draft.autosave,
        queued: false,
        lastScheduledAt: null,
        lastAttemptAt: null,
      },
    },
  };
}

export function builderDocumentReducer(
  state: BuilderDocumentState,
  action: BuilderDocumentAction,
): BuilderDocumentState {
  if (action.type === "hydrate-draft") {
    return hydrateBuilderDocumentState(state, action.payload);
  }

  if (action.type === "mark-draft-saved") {
    const savedVersion = typeof action.version === "number" && Number.isFinite(action.version) ? action.version : state.draft.version.draft;
    const checkpoint = snapshotDraftCheckpoint(state.draft.workspace, savedVersion, action.savedAt);

    return {
      ...state,
      notice: {
        tone: "info",
        text: "Draft kaydedildi.",
      },
      draft: {
        ...state.draft,
        checkpoint,
        version: {
          draft: savedVersion,
          published: state.published.version,
          saved: savedVersion,
        },
        dirty: false,
        lastEditedAt: action.savedAt ?? state.draft.lastEditedAt,
        autosave: {
          ...state.draft.autosave,
          queued: false,
          lastScheduledAt: null,
          lastAttemptAt: action.savedAt ?? state.draft.autosave.lastAttemptAt,
        },
      },
    };
  }

  if (action.type === "mark-draft-published") {
    return {
      ...state,
      notice: {
        tone: "info",
        text: "Website yayınlandı.",
      },
      published: {
        ...state.published,
        version: action.publishedVersion,
        publishedAt: action.publishedAt,
      },
      draft: {
        ...state.draft,
        // Publish, draft'in KENDI icerigini degistirmez — yalnizca "bu
        // draft'in hangi published surumden turedigi" bilgisini gunceller.
        // draft.version.draft / dirty / checkpoint bilerek DOKUNULMAZ.
        version: {
          ...state.draft.version,
          published: action.publishedVersion,
        },
      },
    };
  }

  if (action.type === "discard-draft") {
    const workspace = createWorkspaceStateFromSnapshot(state.draft.checkpoint.workspace);

    return {
      ...state,
      notice: {
        tone: "info",
        text: "Kaydedilen draft geri yuklendi.",
      },
      draft: {
        ...state.draft,
        workspace,
        version: {
          ...state.draft.version,
          draft: state.draft.version.saved,
        },
        dirty: false,
        lastEditedAt: null,
        autosave: {
          ...state.draft.autosave,
          queued: false,
          lastScheduledAt: null,
        },
      },
    };
  }

  if (action.type === "reset-draft-to-published") {
    const workspace = createWorkspaceStateFromSnapshot(state.published.workspace);

    return {
      ...state,
      notice: {
        tone: "info",
        text: "Draft published baseline'a sifirlandi.",
      },
      draft: {
        ...state.draft,
        workspace,
        checkpoint: {
          version: state.published.version,
          savedAt: null,
          workspace: structuredClone(state.published.workspace),
        },
        version: {
          draft: state.published.version,
          published: state.published.version,
          saved: state.published.version,
        },
        dirty: false,
        lastEditedAt: null,
        autosave: {
          ...state.draft.autosave,
          queued: false,
          lastScheduledAt: null,
          lastAttemptAt: null,
        },
      },
    };
  }

  const nextWorkspace = workspaceReducer(state.draft.workspace, action);

  if (nextWorkspace === state.draft.workspace) {
    return state;
  }

  const dirty = isWorkspaceDirty(nextWorkspace, state.draft.checkpoint.workspace);
  const mutating = isMutatingAction(action);

  return {
    ...state,
    notice: null,
    draft: {
      ...state.draft,
      workspace: nextWorkspace,
      version: {
        ...state.draft.version,
        draft: mutating ? state.draft.version.draft + 1 : state.draft.version.draft,
        published: state.published.version,
      },
      dirty,
      lastEditedAt: mutating ? nowIso() : state.draft.lastEditedAt,
      autosave: {
        ...state.draft.autosave,
        queued: false,
      },
    },
  };
}

export function getDraftWorkspace(state: BuilderDocumentState): WorkspaceState {
  return state.draft.workspace;
}

export function getPublishedWorkspace(state: BuilderDocumentState): WorkspaceSnapshot {
  return state.published.workspace;
}

export function getDraftVersionLabel(state: BuilderDocumentState): string {
  return `v${state.draft.version.draft}`;
}

export function getPublishedVersionLabel(state: BuilderDocumentState): string {
  return `v${state.published.version}`;
}

export function getSavedVersionLabel(state: BuilderDocumentState): string {
  return `v${state.draft.version.saved}`;
}

export function hasUnpublishedBuilderChanges(state: BuilderDocumentState): boolean {
  return state.draft.dirty || state.draft.version.saved !== state.draft.version.published;
}

export function getUnsavedChangesNotice(state: BuilderDocumentState): string | null {
  if (!state.draft.dirty) {
    return null;
  }

  return "Kaydedilmemis degisiklikler var. Kaydetmeden cikarsan son manual kayit geri gelir.";
}

export function canAutosave(state: BuilderDocumentState): boolean {
  return state.draft.autosave.enabled && state.draft.dirty;
}

export function getBuilderDraftStorageKey() {
  return DRAFT_STORAGE_KEY;
}

export function createBuilderDraftPersistenceRecord(
  state: BuilderDocumentState,
  savedAt = nowIso(),
): BuilderDraftPersistenceRecord {
  return {
    version: {
      draft: state.draft.version.draft,
      published: state.published.version,
      saved: state.draft.version.draft,
    },
    savedAt,
    workspace: snapshotWorkspaceState({
      pages: state.draft.workspace.pages,
      selectedPageId: state.draft.workspace.selectedPageId,
      selectedSectionByPageId: state.draft.workspace.selectedSectionByPageId,
    }),
  };
}

export function serializeBuilderDraftPersistenceRecord(
  record: BuilderDraftPersistenceRecord,
): string {
  return JSON.stringify(record);
}

export function parseBuilderDraftPersistenceRecord(
  value: string | null | undefined,
): BuilderDraftPersistenceRecord | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<BuilderDraftPersistenceRecord>;

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!isVersionState(parsed.version) || typeof parsed.savedAt !== "string" || !isWorkspaceSnapshot(parsed.workspace)) {
      return null;
    }

    return {
      version: parsed.version,
      savedAt: parsed.savedAt,
      workspace: parsed.workspace,
    };
  } catch {
    return null;
  }
}

export function readPersistedBuilderDraft(
  storage: Pick<Storage, "getItem">,
  key = DRAFT_STORAGE_KEY,
): BuilderDraftPersistenceRecord | null {
  return parseBuilderDraftPersistenceRecord(storage.getItem(key));
}

export function writePersistedBuilderDraft(
  storage: Pick<Storage, "setItem">,
  record: BuilderDraftPersistenceRecord,
  key = DRAFT_STORAGE_KEY,
): boolean {
  try {
    storage.setItem(key, serializeBuilderDraftPersistenceRecord(record));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedBuilderDraft(
  storage: Pick<Storage, "removeItem">,
  key = DRAFT_STORAGE_KEY,
): void {
  try {
    storage.removeItem(key);
  } catch {
    // storage unavailable or blocked; discard remains in-memory only
  }
}

export function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.pages) &&
    typeof record.selectedPageId === "string" &&
    record.selectedSectionByPageId !== null &&
    typeof record.selectedSectionByPageId === "object"
  );
}

function isVersionState(value: unknown): value is BuilderVersionState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.draft === "number" && typeof record.published === "number" && typeof record.saved === "number";
}

function isMutatingAction(action: BuilderDocumentAction): boolean {
  return (
    "type" in action &&
    action.type !== "reset-draft-to-published" &&
    action.type !== "hydrate-draft" &&
    action.type !== "mark-draft-saved" &&
    action.type !== "mark-draft-published" &&
    action.type !== "discard-draft" &&
    MUTATING_WORKSPACE_ACTIONS.has(action.type)
  );
}

function isWorkspaceDirty(nextWorkspace: WorkspaceState, checkpoint: WorkspaceSnapshot): boolean {
  return workspaceContentSignature(nextWorkspace.pages) !== workspaceContentSignature(checkpoint.pages);
}

function workspaceContentSignature(pages: WorkspacePage[]): string {
  return JSON.stringify(pages);
}

function snapshotWorkspace(workspace: WorkspaceState): WorkspaceSnapshot {
  return snapshotWorkspaceState({
    pages: workspace.pages,
    selectedPageId: workspace.selectedPageId,
    selectedSectionByPageId: workspace.selectedSectionByPageId,
  });
}

function snapshotDraftCheckpoint(
  workspace: WorkspaceState,
  version: number,
  savedAt: string | undefined,
): BuilderDraftCheckpoint {
  return {
    version,
    savedAt: savedAt ?? nowIso(),
    workspace: snapshotWorkspace(workspace),
  };
}

function createAutosaveState(): BuilderAutosaveState {
  return {
    enabled: false,
    intervalMs: DEFAULT_AUTOSAVE_INTERVAL_MS,
    queued: false,
    lastScheduledAt: null,
    lastAttemptAt: null,
  };
}

function nowIso() {
  return new Date().toISOString();
}
