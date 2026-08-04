"use client";

import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { LivePreview } from "@/components/builder/admin/live-preview";
import {
  builderDocumentReducer,
  createBuilderDraftPersistenceRecord,
  createInitialBuilderDocumentState,
  getDraftVersionLabel,
  getPublishedVersionLabel,
  getSavedVersionLabel,
  getUnsavedChangesNotice,
  hasUnpublishedBuilderChanges,
  type BuilderDraftPersistenceRecord,
} from "@/lib/builder/document-state";
import { getBlockDefinition } from "@/lib/builder/registry";
import {
  getPageRoute,
  getSelectedPage,
  getSelectedSection,
  listPaletteBlocks,
  normalizePageKey,
  validatePageKeyCandidate,
  type WorkspacePage,
  type WorkspacePagePatch,
} from "@/lib/builder/workspace-state";
import type { EditableSection } from "@/lib/builder/editable-section";
import { asBlockKey, type JsonRecord } from "@/lib/builder/types";
import type { PreviewMode } from "@/components/builder/responsive-preview-frame";
import { SUPPORTED_LANGUAGES } from "@/lib/languages";
import {
  BUILDER_FIELD_LABELS,
  getTranslatablePageFields,
  getTranslatableSectionFields,
} from "@/lib/builder/translatable-fields";
import "@/lib/builder/templates/index";

type BuilderDraftApiRecord = {
  id: string;
  businessId: string;
  draftVersion: number;
  basePublishedVersion: number;
  document: BuilderDraftPersistenceRecord;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

type BuilderDraftApiResponse =
  | {
      ok: true;
      draft: BuilderDraftApiRecord;
    }
  | {
      ok: false;
      code?: string;
      message?: string;
      currentVersion?: number;
      issues?: Array<{ path: string; message: string }>;
    };

type BuilderPublishApiResponse =
  | {
      ok: true;
      revisionId: string;
      publishedVersion: number;
      draftVersion: number;
      publishedAt: string;
    }
  | {
      ok: false;
      code?: string;
      message?: string;
      currentDraftVersion?: number;
      currentPublishedVersion?: number;
      issues?: Array<{ path: string; message: string }>;
    };

type DraftLoadState = "loading" | "ready" | "error";
type DraftSaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type DraftPublishState = "idle" | "publishing" | "published" | "error" | "conflict";

type BuilderVersionSummary = {
  version: number;
  revisionId: string;
  status: string;
  source: string;
  note: string;
  createdAt: string;
  createdBy: string | null;
  hasBuilderDocument: boolean;
  isActive: boolean;
};

type BuilderVersionsApiResponse =
  | { ok: true; versions: BuilderVersionSummary[] }
  | { ok: false; code?: string; message?: string };

type BuilderVersionDocumentApiResponse =
  | { ok: true; version: number; document: BuilderDraftPersistenceRecord }
  | { ok: false; code?: string; message?: string };

type BuilderRollbackApiResponse =
  | { ok: true; revisionId: string; publishedVersion: number; publishedAt: string }
  | { ok: false; code?: string; message?: string };

type RollbackState = "idle" | "rolling-back" | "done" | "error";
type VersionPreviewLoadState = "idle" | "loading" | "ready" | "error";

export function WebsiteBuilderShell() {
  const [documentState, dispatch] = useReducer(
    builderDocumentReducer,
    undefined,
    createInitialBuilderDocumentState,
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [draftLoadState, setDraftLoadState] = useState<DraftLoadState>("loading");
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [draftSaveState, setDraftSaveState] = useState<DraftSaveState>("idle");
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<DraftPublishState>("idle");
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const isSavingRef = useRef(false);
  const isPublishingRef = useRef(false);

  // Faz 13 — Version History / Rollback / Preview.
  const [versions, setVersions] = useState<BuilderVersionSummary[]>([]);
  const [versionsLoadState, setVersionsLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [rollbackState, setRollbackState] = useState<RollbackState>("idle");
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);
  const isRollingBackRef = useRef(false);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const [previewDocument, setPreviewDocument] = useState<BuilderDraftPersistenceRecord | null>(null);
  const [previewLoadState, setPreviewLoadState] = useState<VersionPreviewLoadState>("idle");

  async function loadVersions() {
    setVersionsLoadState("loading");
    try {
      const response = await fetch("/api/business/site-builder/versions", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as BuilderVersionsApiResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Sürüm geçmişi yüklenemedi.");
      }
      setVersions(payload.versions);
      setVersionsLoadState("ready");
    } catch {
      setVersionsLoadState("error");
    }
  }

  useEffect(() => {
    void loadVersions();
  }, []);

  async function handlePreviewVersion(version: number) {
    if (previewVersion === version) {
      // Ayni surume tekrar tiklamak onizlemeyi kapatir.
      setPreviewVersion(null);
      setPreviewDocument(null);
      setPreviewLoadState("idle");
      return;
    }

    setPreviewVersion(version);
    setPreviewDocument(null);
    setPreviewLoadState("loading");

    try {
      const response = await fetch(`/api/business/site-builder/versions?version=${version}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as BuilderVersionDocumentApiResponse | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Sürüm yüklenemedi.");
      }
      setPreviewDocument(payload.document);
      setPreviewLoadState("ready");
    } catch {
      setPreviewLoadState("error");
    }
  }

  async function handleRollback(targetRevisionId: string, targetVersion: number) {
    // Cift tiklamayi senkron ref kilidiyle engelle (save/publish ile ayni desen).
    if (isRollingBackRef.current || rollbackState === "rolling-back") {
      return;
    }

    const confirmed = window.confirm(
      `v${targetVersion} sürümüne geri dönülecek. Bu, mevcut yayını DEĞİŞTİRMEZ yalnızca yeni bir sürüm olarak eklenir. Devam edilsin mi?`,
    );

    if (!confirmed) {
      return;
    }

    isRollingBackRef.current = true;
    setRollbackState("rolling-back");
    setRollbackMessage(null);

    try {
      const response = await fetch("/api/business/site-builder/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRevisionId }),
      });
      const payload = (await response.json().catch(() => null)) as BuilderRollbackApiResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Geri alma işlemi başarısız.");
      }

      setRollbackState("done");
      setRollbackMessage(
        `Geri alma tamamlandı: yeni sürüm v${payload.publishedVersion} olarak yayınlandı. Not: taslağınızın kendi "yayın referansı" bu işlemden etkilenmez, bir sonraki normal yayınlama otomatik olarak doğru sürümden devam eder.`,
      );
      setPreviewVersion(null);
      setPreviewDocument(null);
      await loadVersions();
    } catch (error) {
      setRollbackState("error");
      setRollbackMessage(error instanceof Error ? error.message : "Geri alma işlemi başarısız.");
    } finally {
      isRollingBackRef.current = false;
    }
  }

  // dirty=true iken sekme kapatma/yenileme/navigasyon icin uyari goster.
  // dirty=false oldugu an (save basarili, discard, hydration) effect temizlenir
  // ve listener kaldirilir; unmount'ta da her zaman temizlenir.
  useEffect(() => {
    if (!documentState.draft.dirty) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [documentState.draft.dirty]);

  useEffect(() => {
    let cancelled = false;

    async function loadDraft() {
      setDraftLoadState("loading");
      setDraftLoadError(null);

      try {
        const response = await fetch("/api/business/site-builder/draft", {
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => null)) as BuilderDraftApiResponse | null;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && !payload.ok && payload.message ? payload.message : "Draft yuklenemedi.");
        }

        if (cancelled) {
          return;
        }

        dispatch({ type: "hydrate-draft", payload: payload.draft.document });
        setDraftLoadState("ready");
        setDraftSaveState("idle");
        setDraftSaveMessage(null);
        // Taze bir draft yuklendiginde onceki publish conflict/error durumu
        // artik gecerli degil (versiyonlar guncellendi) — sifirla.
        setPublishState("idle");
        setPublishMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDraftLoadState("error");
        setDraftLoadError(error instanceof Error ? error.message : "Draft yuklenemedi.");
      }
    }

    loadDraft();

    return () => {
      cancelled = true;
    };
  }, []);

  const workspace = documentState.draft.workspace;
  const draftVersionLabel = getDraftVersionLabel(documentState);
  const publishedVersionLabel = getPublishedVersionLabel(documentState);
  const savedVersionLabel = getSavedVersionLabel(documentState);
  const unsavedChangesNotice = getUnsavedChangesNotice(documentState);

  const selectedPage = getSelectedPage(workspace);
  const selectedSection = getSelectedSection(workspace);
  const paletteBlocks = listPaletteBlocks();
  const sectionCount = selectedPage?.sections.length ?? 0;

  if (draftLoadState === "loading") {
    return <BuilderLoadingState />;
  }

  if (draftLoadState === "error") {
    return (
      <BuilderErrorState
        error={draftLoadError ?? "Draft yuklenemedi."}
        onRetry={() => {
          setDraftLoadState("loading");
          setDraftLoadError(null);
          setDraftSaveState("idle");
          setDraftSaveMessage(null);
          void fetch("/api/business/site-builder/draft", { cache: "no-store" })
            .then(async (response) => {
              const payload = (await response.json().catch(() => null)) as BuilderDraftApiResponse | null;
              if (!response.ok || !payload || !payload.ok) {
                throw new Error(payload && !payload.ok && payload.message ? payload.message : "Draft yuklenemedi.");
              }
              dispatch({ type: "hydrate-draft", payload: payload.draft.document });
              setDraftLoadState("ready");
            })
            .catch((error) => {
              setDraftLoadState("error");
              setDraftLoadError(error instanceof Error ? error.message : "Draft yuklenemedi.");
            });
        }}
      />
    );
  }

  if (!selectedPage) {
    return <WorkspaceEmptyState />;
  }

  function handleSelectPage(pageId: string) {
    dispatch({ type: "select-page", pageId });
  }

  function handleSelectSection(pageId: string, sectionId: string | null) {
    dispatch({ type: "select-section", pageId, sectionId });
  }

  function handleClearSelection(pageId: string) {
    dispatch({ type: "clear-selected-section", pageId });
  }

  function handleAddBlock(blockKey: string) {
    dispatch({ type: "add-block", pageId: selectedPage.id, blockKey: asBlockKey(blockKey) });
  }

  function handleCloneSection(sectionId: string) {
    dispatch({ type: "clone-section", pageId: selectedPage.id, sectionId });
  }

  function handleDeleteSection(section: EditableSection) {
    const isLastSection = selectedPage.sections.length === 1;
    const confirmed = window.confirm(
      isLastSection
        ? "Bu sayfada yalnizca bir section kaldı. Silmeye devam etmek ister misiniz?"
        : "Bu section silinsin mi?",
    );

    if (!confirmed) {
      return;
    }

    dispatch({ type: "delete-section", pageId: selectedPage.id, sectionId: section.id });
  }

  function handleSectionToggle(sectionId: string) {
    dispatch({ type: "toggle-section", pageId: selectedPage.id, sectionId });
  }

  function handleSectionMove(sectionId: string, direction: "up" | "down") {
    dispatch({ type: "move-section", pageId: selectedPage.id, sectionId, direction });
  }

  function handleSectionReorder(fromId: string, toId: string) {
    dispatch({ type: "reorder-section", pageId: selectedPage.id, fromId, toId });
    dispatch({ type: "select-section", pageId: selectedPage.id, sectionId: fromId });
  }

  function handleSectionContent(sectionId: string, patch: JsonRecord) {
    dispatch({ type: "update-section-content", pageId: selectedPage.id, sectionId, patch });
  }

  function handleSectionStyle(sectionId: string, patch: JsonRecord) {
    dispatch({ type: "update-section-style", pageId: selectedPage.id, sectionId, patch });
  }

  function handleSectionVariant(sectionId: string, variantKey: string) {
    dispatch({ type: "update-section-variant", pageId: selectedPage.id, sectionId, variantKey });
  }

  function handlePagePatch(patch: WorkspacePagePatch) {
    dispatch({ type: "update-page", pageId: selectedPage.id, patch });
  }

  function handlePageKeyChange(value: string) {
    const normalized = normalizePageKey(value);
    const check = validatePageKeyCandidate(workspace, selectedPage.id, normalized);

    if (!check.valid) {
      return;
    }

    handlePagePatch({ key: check.normalized });
  }

  async function handleSaveDraft() {
    // React state (draftSaveState) sadece bir sonraki render'da guncellenir;
    // ayni tick icinde hizli cift tiklama bu kontrolu atlayabilir. Senkron
    // bir ref kilidi, iki PUT'un ayni anda tetiklenmesini kesin olarak engeller.
    if (isSavingRef.current || !documentState.draft.dirty || draftSaveState === "conflict") {
      return;
    }

    isSavingRef.current = true;
    setDraftSaveState("saving");
    setDraftSaveMessage(null);

    try {
      const record = createBuilderDraftPersistenceRecord(documentState);
      const response = await fetch("/api/business/site-builder/draft", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          document: record,
          expectedVersion: documentState.draft.checkpoint.version,
        }),
      });

      const payload = (await response.json().catch(() => null)) as BuilderDraftApiResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        if (response.status === 409) {
          setDraftSaveState("conflict");
          setDraftSaveMessage(payload && !payload.ok && payload.message ? payload.message : "Bu taslak başka bir oturumda güncellendi.");
          return;
        }

        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Draft kaydedilemedi.");
      }

      dispatch({
        type: "mark-draft-saved",
        savedAt: payload.draft.document.savedAt,
        version: payload.draft.draftVersion,
      });
      setDraftSaveState("saved");
      setDraftSaveMessage("Draft sunucuya kaydedildi.");
    } catch (error) {
      setDraftSaveState("error");
      setDraftSaveMessage(error instanceof Error ? error.message : "Draft kaydedilemedi.");
    } finally {
      isSavingRef.current = false;
    }
  }

  async function handleDiscardDraft() {
    const confirmed = window.confirm(
      "Kaydedilmemis degisiklikler son kaydedilen taslaga geri alinsin mi?",
    );

    if (!confirmed) {
      return;
    }

    setDraftSaveState("saving");
    setDraftSaveMessage(null);

    try {
      const response = await fetch("/api/business/site-builder/draft", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as BuilderDraftApiResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Draft geri yuklenemedi.");
      }

      dispatch({ type: "hydrate-draft", payload: payload.draft.document });
      setDraftSaveState("idle");
      setDraftSaveMessage("Sunucudaki son draft geri yuklendi.");
      setPublishState("idle");
      setPublishMessage(null);
    } catch (error) {
      setDraftSaveState("error");
      setDraftSaveMessage(error instanceof Error ? error.message : "Draft geri yuklenemedi.");
    }
  }

  async function handlePublish() {
    // Ayni tick icinde cift tiklamayi senkron ref kilidiyle engelle (save
    // butonundaki desenle ayni). Ayrica dirty/hazir-degil/conflict
    // durumlarinda publish'in "kor" sekilde denenmesini engelle — buton zaten
    // disabled olur ama fonksiyon da kendi basina guvenli olmali.
    if (
      isPublishingRef.current ||
      documentState.draft.dirty ||
      draftLoadState !== "ready" ||
      draftSaveState === "saving" ||
      publishState === "publishing" ||
      publishState === "conflict"
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Kaydedilmiş taslak canlı site sürümüne dönüştürülecek. Devam edilsin mi?",
    );

    if (!confirmed) {
      return;
    }

    isPublishingRef.current = true;
    setPublishState("publishing");
    setPublishMessage(null);

    try {
      const response = await fetch("/api/business/site-builder/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expectedDraftVersion: documentState.draft.version.draft,
          expectedPublishedVersion: documentState.draft.version.published,
        }),
      });

      const payload = (await response.json().catch(() => null)) as BuilderPublishApiResponse | null;

      if (!response.ok || !payload || !payload.ok) {
        if (response.status === 409) {
          setPublishState("conflict");
          setPublishMessage(
            payload && !payload.ok && payload.message
              ? payload.message
              : "Yayın başka bir oturumda değişti.",
          );
          return;
        }

        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Yayın işlemi başarısız.");
      }

      dispatch({
        type: "mark-draft-published",
        publishedVersion: payload.publishedVersion,
        publishedAt: payload.publishedAt,
      });
      setPublishState("published");
      setPublishMessage(`Website yayınlandı (v${payload.publishedVersion}).`);
      await loadVersions();
    } catch (error) {
      setPublishState("error");
      setPublishMessage(error instanceof Error ? error.message : "Yayın işlemi başarısız.");
    } finally {
      isPublishingRef.current = false;
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_392px]">
      <aside className="surface-strong flex flex-col gap-4 rounded-[28px] p-5 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-y-auto">
        <div className="rounded-[24px] bg-slate-950 px-5 py-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Preview only
          </p>
          <h1 className="mt-3 text-2xl font-semibold">Website Builder</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Block palette, section actions ve page settings tek bir preview state icinde calisir.
          </p>
        </div>

        <PanelCard
          eyebrow="Pages"
          title="Sayfa agaci"
          description="Home, Services, Vehicles, Routes, Blog ve Contact sayfalari bagimsiz tutulur."
        >
          <div className="grid gap-2">
            {workspace.pages.map((page) => {
              const activeCount = page.sections.filter((section) => section.active).length;
              const isActive = page.id === selectedPage.id;

              return (
                <button
                  key={page.id}
                  className={[
                    "flex flex-col rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => handleSelectPage(page.id)}
                  type="button"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{page.title}</div>
                      <div className={["mt-1 text-xs", isActive ? "text-slate-300" : "text-slate-500"].join(" ")}>
                        {page.key} | {getPageRoute(page.key)}
                      </div>
                    </div>
                    <span className={["text-xs font-semibold uppercase tracking-[0.2em]", isActive ? "text-slate-300" : "text-slate-500"].join(" ")}>
                      {activeCount}/{page.sections.length}
                    </span>
                  </div>
                  <div className={["mt-2 text-xs", isActive ? "text-slate-300" : "text-slate-500"].join(" ")}>
                    {page.active ? "Active" : "Pasif"} | {page.containerWidth} width
                  </div>
                </button>
              );
            })}
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="Block palette"
          title="Blok ekle"
          description="Registry'den otomatik beslenen blok kartlari."
        >
          <div className="grid gap-3">
            {paletteBlocks.map((definition) => (
              <article
                key={String(definition.key)}
                className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {definition.label.slice(0, 3)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-950">
                      {definition.label}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{definition.family}</div>
                    <div className="mt-2 text-xs leading-5 text-slate-600">
                      {definition.description}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {definition.variants.map((variant) => (
                    <span
                      key={String(variant.key)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600"
                    >
                      {variant.label}
                    </span>
                  ))}
                </div>

                <button
                  className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                  onClick={() => handleAddBlock(String(definition.key))}
                  type="button"
                >
                  Ekle
                </button>
              </article>
            ))}
          </div>
        </PanelCard>

        <PanelCard
          eyebrow="Sections"
          title={`${selectedPage.title} blocks`}
          description="Sira, duplicate, silme ve aktif/pasif islemleri buradan da yonetilir."
        >
          <div className="grid gap-2">
            {selectedPage.sections.map((section, index) => {
              const definition = getBlockDefinition(section.blockKey);
              const isSelected = selectedSection?.id === section.id;
              const isFirst = index === 0;
              const isLast = index === selectedPage.sections.length - 1;

              return (
                <article
                  key={section.id}
                  className={[
                    "rounded-2xl border px-4 py-3 transition",
                    isSelected
                      ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/10"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <button
                    className="flex w-full items-start gap-3 text-left"
                    onClick={() => handleSelectSection(selectedPage.id, section.id)}
                    type="button"
                  >
                    <div className="mt-0.5 rounded-full border border-dashed border-current px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] opacity-70">
                      drag
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="block truncate text-sm font-semibold">
                          {definition?.label ?? String(section.blockKey)}
                        </span>
                        <span className={["text-xs font-semibold uppercase tracking-[0.18em]", isSelected ? "text-slate-300" : "text-slate-500"].join(" ")}>
                          #{index + 1}
                        </span>
                      </div>
                      <div className={["mt-1 text-xs", isSelected ? "text-slate-300" : "text-slate-500"].join(" ")}>
                        {String(section.variantKey)} | {section.active ? "Visible" : "Pasif"}
                      </div>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <SectionActionButton
                      label={section.active ? "Pasif" : "Aktif"}
                      onClick={() => handleSectionToggle(section.id)}
                    />
                    <SectionActionButton label="Kopyala" onClick={() => handleCloneSection(section.id)} />
                    <SectionActionButton
                      label="Sil"
                      tone="destructive"
                      onClick={() => handleDeleteSection(section)}
                    />
                    <SectionActionButton
                      disabled={isFirst}
                      label="Yukari"
                      onClick={() => handleSectionMove(section.id, "up")}
                    />
                    <SectionActionButton
                      disabled={isLast}
                      label="Asagi"
                      onClick={() => handleSectionMove(section.id, "down")}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </PanelCard>

        <PanelCard eyebrow="History" title="Undo / Redo" description="Hafif memory history son 20 islemi tutar.">
          <div className="flex flex-wrap gap-2">
            <SectionActionButton label="Undo" onClick={() => dispatch({ type: "undo" })} />
            <SectionActionButton label="Redo" onClick={() => dispatch({ type: "redo" })} />
            <SectionActionButton
              label="Secimi temizle"
              onClick={() => handleClearSelection(selectedPage.id)}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Page switch, add, clone, delete, reorder, active/passive, content/style ve page settings history'ye girer.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Autosave hazirlik modu pasif durumda; {documentState.draft.autosave.intervalMs / 1000}s aralik ve draft dirty takibi hazir.
          </p>
        </PanelCard>

        <PanelCard
          eyebrow="Version History"
          title="Sürüm geçmişi"
          description="Her yayın kalıcı bir sürüm olarak listelenir; eski bir sürüme dönmek yeni bir sürüm oluşturur, hiçbir satır değiştirilmez."
        >
          {versionsLoadState === "loading" ? (
            <p className="text-xs text-slate-500">Yükleniyor...</p>
          ) : versionsLoadState === "error" ? (
            <p className="text-xs text-rose-600">Sürüm geçmişi yüklenemedi.</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-slate-500">Henüz hiç yayın yapılmadı.</p>
          ) : (
            <div className="grid gap-2">
              {versions.map((version) => (
                <article
                  key={version.revisionId}
                  className="rounded-2xl border border-slate-200 bg-white p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-950">v{version.version}</span>
                    {version.isActive ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Aktif
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {new Date(version.createdAt).toLocaleString("tr-TR")} · {version.source}
                  </div>
                  {version.note ? <div className="mt-1 text-xs text-slate-600">{version.note}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <SectionActionButton
                      label={previewVersion === version.version ? "Önizlemeyi kapat" : "Önizle"}
                      onClick={() => void handlePreviewVersion(version.version)}
                    />
                    <SectionActionButton
                      label="Bu sürüme geri dön"
                      disabled={rollbackState === "rolling-back" || version.isActive}
                      onClick={() => void handleRollback(version.revisionId, version.version)}
                    />
                  </div>

                  {previewVersion === version.version ? (
                    <VersionPreviewPanel
                      loadState={previewLoadState}
                      document={previewDocument}
                      currentPageKey={selectedPage.key}
                    />
                  ) : null}
                </article>
              ))}
            </div>
          )}

          {rollbackMessage ? (
            <p className={`mt-3 text-xs ${rollbackState === "error" ? "text-rose-600" : "text-emerald-600"}`}>
              {rollbackMessage}
            </p>
          ) : null}
        </PanelCard>
      </aside>

      <section className="grid min-w-0 gap-4">
        <header className="surface-strong rounded-[28px] px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                  Live preview
                </p>
                <Badge>{selectedPage.key}</Badge>
                <Badge>{sectionCount} blocks</Badge>
                <Badge>{selectedPage.active ? "Page active" : "Page passive"}</Badge>
                <Badge>Taslak {draftVersionLabel}</Badge>
                <Badge>Kayitli {savedVersionLabel}</Badge>
                <Badge>Yayinda {publishedVersionLabel}</Badge>
                {documentState.draft.dirty ? <Badge>Kaydedilmedi</Badge> : null}
                {draftSaveState === "saving" ? <Badge>Kaydediliyor</Badge> : null}
                {draftSaveState === "conflict" ? <Badge>Conflict</Badge> : null}
                {publishState === "publishing" ? <Badge>Yayınlanıyor...</Badge> : null}
                {publishState === "conflict" ? <Badge>Publish conflict</Badge> : null}
                {publishState === "error" ? <Badge>Publish error</Badge> : null}
                {publishState !== "publishing" && hasUnpublishedBuilderChanges(documentState) ? (
                  <Badge>Yayınlanmamış değişiklik var</Badge>
                ) : (
                  <Badge>Yayında</Badge>
                )}
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {selectedPage.title}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                {selectedPage.description} Degisiklikler yalnizca draft preview state'te calisir.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentButton active={workspace.selectedPageId === selectedPage.id} onClick={() => handleSelectPage(selectedPage.id)}>
                Selected
              </SegmentButton>
              <SegmentButton
                active={workspace.history.past.length > 0}
                onClick={() => dispatch({ type: "undo" })}
              >
                Undo
              </SegmentButton>
              <SegmentButton
                active={workspace.history.future.length > 0}
                onClick={() => dispatch({ type: "redo" })}
              >
                Redo
              </SegmentButton>
              <SegmentButton
                active={documentState.draft.dirty}
                disabled={
                  !documentState.draft.dirty || draftSaveState === "saving" || draftSaveState === "conflict"
                }
                onClick={() => void handleSaveDraft()}
              >
                Taslagi Kaydet
              </SegmentButton>
              <SegmentButton
                active={documentState.draft.dirty}
                disabled={!documentState.draft.dirty}
                onClick={() => void handleDiscardDraft()}
              >
                Vazgec
              </SegmentButton>
              <SegmentButton
                active={hasUnpublishedBuilderChanges(documentState)}
                disabled={
                  documentState.draft.dirty ||
                  draftLoadState !== "ready" ||
                  draftSaveState === "saving" ||
                  publishState === "publishing" ||
                  publishState === "conflict"
                }
                onClick={() => void handlePublish()}
              >
                {publishState === "publishing" ? "Yayınlanıyor..." : "Yayınla"}
              </SegmentButton>
              <SegmentButton active={previewMode === "desktop"} onClick={() => setPreviewMode("desktop")}>
                Desktop
              </SegmentButton>
              <SegmentButton active={previewMode === "tablet"} onClick={() => setPreviewMode("tablet")}>
                Tablet
              </SegmentButton>
              <SegmentButton active={previewMode === "mobile"} onClick={() => setPreviewMode("mobile")}>
                Mobile
              </SegmentButton>
            </div>
          </div>

          {unsavedChangesNotice ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {unsavedChangesNotice}
            </div>
          ) : null}

          {documentState.notice ? (
            <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {documentState.notice.text}
            </div>
          ) : null}

          {draftSaveMessage ? (
            <div
              className={[
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                draftSaveState === "error" || draftSaveState === "conflict"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {draftSaveMessage}
            </div>
          ) : null}

          {publishMessage ? (
            <div
              className={[
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                publishState === "error" || publishState === "conflict"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700",
              ].join(" ")}
            >
              {publishMessage}
            </div>
          ) : null}

          {workspace.notice ? (
            <div
              className={[
                "mt-4 rounded-2xl border px-4 py-3 text-sm",
                workspace.notice.tone === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-sky-200 bg-sky-50 text-sky-700",
              ].join(" ")}
            >
              {workspace.notice.text}
              <button
                className="ml-3 text-xs font-semibold uppercase tracking-[0.2em] underline"
                onClick={() => dispatch({ type: "dismiss-notice" })}
                type="button"
              >
                Kapat
              </button>
            </div>
          ) : null}
        </header>

        <div className="surface-strong overflow-hidden rounded-[28px]">
          <LivePreview
            mode={previewMode}
            onReorderSection={handleSectionReorder}
            onSelectSection={(sectionId) => handleSelectSection(selectedPage.id, sectionId)}
            pageSettings={selectedPage}
            sections={selectedPage.sections}
            selectedSectionId={selectedSection?.id ?? null}
            themeSettings={{
              templateKey: "modern",
              primaryColor: "#0f172a",
              secondaryColor: "#f97316",
              backgroundColor: "#f8fafc",
              surfaceColor: "#ffffff",
              textColor: "#0f172a",
              borderRadius: "lg",
              shadow: "soft",
              fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              colorMode: "light",
            }}
          />
        </div>

        <div className="surface-strong rounded-[28px] p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Builder hints
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                Section secince inspector acilir, secim yoksa page settings gorunur.
              </h3>
            </div>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => handleClearSelection(selectedPage.id)}
              type="button"
            >
              Sayfa Ayarlari
            </button>
          </div>
        </div>
      </section>

      <aside className="surface-strong flex flex-col gap-4 rounded-[28px] p-5 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)] xl:overflow-y-auto">
        {selectedSection ? (
          <SectionInspector
            key={selectedSection.id}
            page={selectedPage}
            section={selectedSection}
            onClearSelection={() => handleClearSelection(selectedPage.id)}
            onContentChange={handleSectionContent}
            onDelete={handleDeleteSection}
            onDuplicate={handleCloneSection}
            onMove={handleSectionMove}
            onStyleChange={handleSectionStyle}
            onVariantChange={handleSectionVariant}
            onToggleActive={handleSectionToggle}
          />
        ) : (
          <PageSettingsInspector
            page={selectedPage}
            onClearSelection={() => handleClearSelection(selectedPage.id)}
            onPagePatch={handlePagePatch}
            onPageKeyChange={handlePageKeyChange}
          />
        )}
      </aside>
    </section>
  );
}

// Faz 13 (item 9) — eski bir surumun READ-ONLY onizlemesi. Mevcut
// LivePreview render katmani AYNEN yeniden kullanilir (yeni bir renderer
// yazilmadi); onSelectSection/onReorderSection bilerek verilmez, boylece
// hicbir edit aksiyonu mumkun olmaz ve draft state'ine hicbir sekilde
// karismaz (yalnizca fetch edilen salt-okunur document'i gosterir).
function VersionPreviewPanel({
  loadState,
  document,
  currentPageKey,
}: {
  loadState: VersionPreviewLoadState;
  document: BuilderDraftPersistenceRecord | null;
  currentPageKey: string;
}) {
  if (loadState === "loading") {
    return <p className="mt-3 text-xs text-slate-500">Önizleme yükleniyor...</p>;
  }

  if (loadState === "error" || !document) {
    return <p className="mt-3 text-xs text-rose-600">Önizleme yüklenemedi.</p>;
  }

  const page = document.workspace.pages.find((entry) => entry.key === currentPageKey) ?? document.workspace.pages[0];

  if (!page) {
    return <p className="mt-3 text-xs text-slate-500">Bu sürümde sayfa bulunamadı.</p>;
  }

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Salt okunur önizleme — {page.key}
      </div>
      <LivePreview
        mode="desktop"
        pageSettings={page}
        sections={page.sections}
        selectedSectionId={null}
        themeSettings={{
          templateKey: "modern",
          primaryColor: "#0f172a",
          secondaryColor: "#f97316",
          backgroundColor: "#f8fafc",
          surfaceColor: "#ffffff",
          textColor: "#0f172a",
          borderRadius: "lg",
          shadow: "soft",
          fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          colorMode: "light",
        }}
      />
    </div>
  );
}

function WorkspaceEmptyState() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="surface-strong w-full max-w-2xl rounded-[28px] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Website Builder
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Builder state could not be initialized
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Preview icin gerekli page seed'leri yuklenemedi.
        </p>
      </div>
    </section>
  );
}

function BuilderLoadingState() {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="surface-strong w-full max-w-2xl rounded-[28px] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Website Builder
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Draft yükleniyor
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Backend draft durumu hazırlanıyor.
        </p>
      </div>
    </section>
  );
}

function BuilderErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="surface-strong w-full max-w-2xl rounded-[28px] p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-500">
          Website Builder
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Draft yüklenemedi
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">{error}</p>
        <button
          className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          onClick={onRetry}
          type="button"
        >
          Yeniden dene
        </button>
      </div>
    </section>
  );
}

function SectionInspector({
  page,
  section,
  onClearSelection,
  onContentChange,
  onDelete,
  onDuplicate,
  onMove,
  onStyleChange,
  onVariantChange,
  onToggleActive,
}: {
  page: WorkspacePage;
  section: EditableSection;
  onClearSelection: () => void;
  onContentChange: (sectionId: string, patch: JsonRecord) => void;
  onDelete: (section: EditableSection) => void;
  onDuplicate: (sectionId: string) => void;
  onMove: (sectionId: string, direction: "up" | "down") => void;
  onStyleChange: (sectionId: string, patch: JsonRecord) => void;
  onVariantChange: (sectionId: string, variantKey: string) => void;
  onToggleActive: (sectionId: string) => void;
}) {
  const definition = getBlockDefinition(section.blockKey);
  const isFirst = section.position === 0;
  const isLast = section.position === page.sections.length - 1;

  return (
    <>
      <PanelCard
        eyebrow="Inspector"
        title="Secili blok"
        description="Content, style ve section aksiyonlari burada."
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-950">
                {definition?.label ?? String(section.blockKey)}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {String(section.blockKey)} | #{section.position + 1}
              </div>
            </div>
            <button
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
                section.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600",
              ].join(" ")}
              onClick={() => onToggleActive(section.id)}
              type="button"
            >
              {section.active ? "Visible" : "Pasif"}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <SectionActionButton disabled={isFirst} label="Yukari" onClick={() => onMove(section.id, "up")} />
            <SectionActionButton disabled={isLast} label="Asagi" onClick={() => onMove(section.id, "down")} />
            <SectionActionButton label="Kopyala" onClick={() => onDuplicate(section.id)} />
            <SectionActionButton label="Sil" tone="destructive" onClick={() => onDelete(section)} />
          </div>
        </div>
      </PanelCard>

      <InspectorGroup title="Variant">
        <SelectField
          label="Block variant"
          onChange={(value) => onVariantChange(section.id, value)}
          options={definition?.variants.map((variant) => ({ value: String(variant.key), label: variant.label })) ?? []}
          value={String(section.variantKey)}
        />
      </InspectorGroup>

      <InspectorGroup title="Content">
        {section.blockKey === "hero" ? (
          <div className="grid gap-3">
            <TextField
              label="Eyebrow"
              onChange={(value) => onContentChange(section.id, { eyebrow: value })}
              value={textValue(section.content, "eyebrow")}
            />
            <TextAreaField
              label="Title"
              onChange={(value) => onContentChange(section.id, { title: value })}
              value={textValue(section.content, "title")}
              rows={3}
            />
            <TextAreaField
              label="Subtitle"
              onChange={(value) => onContentChange(section.id, { subtitle: value })}
              value={textValue(section.content, "subtitle")}
              rows={4}
            />
            <TextField
              label="Primary button"
              onChange={(value) => onContentChange(section.id, { primaryButtonText: value })}
              value={textValue(section.content, "primaryButtonText")}
            />
            <TextField
              label="Primary href"
              onChange={(value) => onContentChange(section.id, { primaryButtonHref: value })}
              value={textValue(section.content, "primaryButtonHref")}
            />
            <TextField
              label="Secondary button"
              onChange={(value) => onContentChange(section.id, { secondaryButtonText: value })}
              value={textValue(section.content, "secondaryButtonText")}
            />
            <TextField
              label="Secondary href"
              onChange={(value) => onContentChange(section.id, { secondaryButtonHref: value })}
              value={textValue(section.content, "secondaryButtonHref")}
            />
          </div>
        ) : null}

        {section.blockKey === "services_grid" ? (
          <div className="grid gap-3">
            <TextField
              label="Eyebrow"
              onChange={(value) => onContentChange(section.id, { eyebrow: value })}
              value={textValue(section.content, "eyebrow")}
            />
            <TextAreaField
              label="Title"
              onChange={(value) => onContentChange(section.id, { title: value })}
              value={textValue(section.content, "title")}
              rows={3}
            />
            <TextAreaField
              label="Description"
              onChange={(value) => onContentChange(section.id, { description: value })}
              value={textValue(section.content, "description")}
              rows={4}
            />
            <TextField
              label="Empty title"
              onChange={(value) => onContentChange(section.id, { emptyStateTitle: value })}
              value={textValue(section.content, "emptyStateTitle")}
            />
            <TextAreaField
              label="Empty description"
              onChange={(value) => onContentChange(section.id, { emptyStateDescription: value })}
              value={textValue(section.content, "emptyStateDescription")}
              rows={3}
            />
            <NumberField
              label="Max items"
              max={24}
              min={1}
              onChange={(value) => onContentChange(section.id, { maxItems: value })}
              value={numberValue(section.content, "maxItems", 6)}
            />
          </div>
        ) : null}

        {section.blockKey === "cta" ? (
          <div className="grid gap-3">
            <TextAreaField
              label="Title"
              onChange={(value) => onContentChange(section.id, { title: value })}
              value={textValue(section.content, "title")}
              rows={3}
            />
            <TextAreaField
              label="Description"
              onChange={(value) => onContentChange(section.id, { description: value })}
              value={textValue(section.content, "description")}
              rows={4}
            />
            <TextField
              label="Button text"
              onChange={(value) => onContentChange(section.id, { primaryButtonText: value })}
              value={textValue(section.content, "primaryButtonText")}
            />
            <TextField
              label="Button href"
              onChange={(value) => onContentChange(section.id, { primaryButtonHref: value })}
              value={textValue(section.content, "primaryButtonHref")}
            />
          </div>
        ) : null}
      </InspectorGroup>

      <InspectorGroup title="Style">
        {section.blockKey === "hero" ? (
          <div className="grid gap-3">
            <SelectField
              label="Align"
              onChange={(value) => onStyleChange(section.id, { align: value })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
              ]}
              value={textValue(section.style, "align", "left")}
            />
            <SelectField
              label="Overlay"
              onChange={(value) => onStyleChange(section.id, { overlay: value })}
              options={[
                { value: "none", label: "None" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={textValue(section.style, "overlay", "none")}
            />
          </div>
        ) : null}

        {section.blockKey === "services_grid" ? (
          <SelectField
            label="Columns"
            onChange={(value) => onStyleChange(section.id, { columns: Number(value) })}
            options={[
              { value: "2", label: "2" },
              { value: "3", label: "3" },
              { value: "4", label: "4" },
            ]}
            value={String(numberValue(section.style, "columns", 3))}
          />
        ) : null}

        {section.blockKey === "cta" ? (
          <SelectField
            label="Tone"
            onChange={(value) => onStyleChange(section.id, { tone: value })}
            options={[
              { value: "brand", label: "Brand" },
              { value: "surface", label: "Surface" },
            ]}
            value={textValue(section.style, "tone", "brand")}
          />
        ) : null}
      </InspectorGroup>

      <TranslationPanel
        sourceId={section.id}
        fields={getTranslatableSectionFields(String(section.blockKey))}
        defaultValues={Object.fromEntries(
          getTranslatableSectionFields(String(section.blockKey)).map((field) => [field, textValue(section.content, field)]),
        )}
      />

      <PanelCard eyebrow="Page" title="Hizli aksiyonlar" description="Sayfa ayarlarina gecmek veya secimi temizlemek icin.">
        <div className="flex flex-wrap gap-2">
          <SectionActionButton label="Sayfa ayarlari" onClick={onClearSelection} />
          <SectionActionButton label="Kopyala" onClick={() => onDuplicate(section.id)} />
        </div>
      </PanelCard>
    </>
  );
}

function PageSettingsInspector({
  page,
  onClearSelection,
  onPagePatch,
  onPageKeyChange,
}: {
  page: WorkspacePage;
  onClearSelection: () => void;
  onPagePatch: (patch: WorkspacePagePatch) => void;
  onPageKeyChange: (value: string) => void;
}) {
  return (
    <>
      <PanelCard
        eyebrow="Inspector"
        title="Page settings"
        description="Section secili degilken sayfa ayarlari burada."
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950">{page.title}</div>
              <div className="mt-1 text-xs text-slate-500">
                {page.key} | {getPageRoute(page.key)}
              </div>
            </div>
            <button
              className={[
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
                page.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600",
              ].join(" ")}
              onClick={() => onPagePatch({ active: !page.active })}
              type="button"
            >
              {page.active ? "Active" : "Pasif"}
            </button>
          </div>
        </div>
      </PanelCard>

      <InspectorGroup title="Page meta">
        <TextField
          label="Page title"
          onChange={(value) => onPagePatch({ title: value })}
          value={page.title}
        />
        <TextField
          label="Page key"
          disabled={page.isSystemPage}
          onChange={onPageKeyChange}
          value={page.key}
        />
        <TextAreaField
          label="Description"
          onChange={(value) => onPagePatch({ description: value })}
          value={page.description}
          rows={3}
        />
        <TextField
          label="SEO title hint"
          onChange={(value) => onPagePatch({ seoTitleHint: value })}
          value={page.seoTitleHint}
        />
        <TextAreaField
          label="SEO description hint"
          onChange={(value) => onPagePatch({ seoDescriptionHint: value })}
          value={page.seoDescriptionHint}
          rows={3}
        />
      </InspectorGroup>

      <TranslationPanel
        sourceId={page.id}
        fields={getTranslatablePageFields()}
        defaultValues={{
          title: page.title,
          description: page.description,
          seoTitleHint: page.seoTitleHint,
          seoDescriptionHint: page.seoDescriptionHint,
        }}
      />

      <InspectorGroup title="Layout">
        <SelectField
          label="Container width"
          onChange={(value) => onPagePatch({ containerWidth: value as WorkspacePage["containerWidth"] })}
          options={[
            { value: "sm", label: "Small" },
            { value: "md", label: "Medium" },
            { value: "lg", label: "Large" },
            { value: "xl", label: "XL" },
            { value: "full", label: "Full" },
          ]}
          value={page.containerWidth}
        />
        <SelectField
          label="Background mode"
          onChange={(value) => onPagePatch({ backgroundMode: value as WorkspacePage["backgroundMode"] })}
          options={[
            { value: "light", label: "Light" },
            { value: "soft", label: "Soft" },
            { value: "dark", label: "Dark" },
          ]}
          value={page.backgroundMode}
        />
        <NumberField
          label="Section gap"
          max={64}
          min={0}
          onChange={(value) => onPagePatch({ sectionGap: value })}
          value={page.sectionGap}
        />
        <NumberField
          label="Top spacing"
          max={120}
          min={0}
          onChange={(value) => onPagePatch({ topSpacing: value })}
          value={page.topSpacing}
        />
        <NumberField
          label="Bottom spacing"
          max={120}
          min={0}
          onChange={(value) => onPagePatch({ bottomSpacing: value })}
          value={page.bottomSpacing}
        />
      </InspectorGroup>

      <PanelCard eyebrow="Actions" title="Sayfa islemleri" description="Secimi temizle ve page settings ekraninda kal.">
        <div className="flex flex-wrap gap-2">
          <SectionActionButton label="Secimi temizle" onClick={onClearSelection} />
        </div>
        <div className="mt-3 text-xs leading-5 text-slate-500">
          System page key kilitli tutulur. Duplicate key denemeleri helper validation ile reddedilir.
        </div>
      </PanelCard>
    </>
  );
}

// Faz 13 — builder icerigi icin coklu dil paneli. Varsayilan dil icerigi
// HER ZAMAN ana document'te kalir (bu panel onu asla degistirmez); burada
// yalnizca SECILI dilin override'lari duzenlenir ve
// /api/business/site-builder/translations uzerinden draft seviyesinde
// kaydedilir (mevcut "Taslagi Kaydet" akisindan BAGIMSIZ). Bos birakilan
// bir alan, o dil icin cevirinin silinmesi/olmamasi anlamina gelir ve
// public render varsayilan dile duser.
function TranslationPanel({
  sourceId,
  fields,
  defaultValues,
}: {
  sourceId: string;
  fields: readonly string[];
  defaultValues: Record<string, string>;
}) {
  const [locale, setLocale] = useState("en");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadState("loading");
      setSaveState("idle");
      setSaveMessage(null);

      try {
        const response = await fetch(
          `/api/business/site-builder/translations?locale=${encodeURIComponent(locale)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json().catch(() => null)) as
          | { ok: true; entries: Array<{ sourceId: string; fieldKey: string; translatedText: string }> }
          | { ok: false; message?: string }
          | null;

        if (!response.ok || !payload || !payload.ok) {
          throw new Error(payload && !payload.ok && payload.message ? payload.message : "Çeviriler yüklenemedi.");
        }

        if (cancelled) {
          return;
        }

        const next: Record<string, string> = {};
        for (const entry of payload.entries) {
          if (entry.sourceId === sourceId) {
            next[entry.fieldKey] = entry.translatedText;
          }
        }
        setOverrides(next);
        setLoadState("ready");
      } catch {
        if (!cancelled) {
          setLoadState("error");
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [locale, sourceId]);

  function handleFieldChange(fieldKey: string, value: string) {
    setOverrides((prev) => ({ ...prev, [fieldKey]: value }));
  }

  async function handleSave() {
    if (isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setSaveState("saving");
    setSaveMessage(null);

    try {
      const entries = fields.map((fieldKey) => ({
        sourceId,
        fieldKey,
        translatedText: overrides[fieldKey] ?? "",
      }));

      const response = await fetch("/api/business/site-builder/translations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, entries }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; issues: Array<{ message: string }> }
        | { ok: false; message?: string }
        | null;

      if (!response.ok || !payload || !payload.ok) {
        throw new Error(payload && !payload.ok && payload.message ? payload.message : "Çeviri kaydedilemedi.");
      }

      setSaveState("saved");
      setSaveMessage(
        payload.issues.length ? `Kaydedildi (${payload.issues.length} alan atlandı).` : "Çeviri kaydedildi.",
      );
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Çeviri kaydedilemedi.");
    } finally {
      isSavingRef.current = false;
    }
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <InspectorGroup title="Çoklu Dil">
      <SelectField
        label="Düzenlenen dil"
        onChange={setLocale}
        options={SUPPORTED_LANGUAGES.map((language) => ({
          value: language.code,
          label: `${language.nativeLabel} (${language.code})`,
        }))}
        value={locale}
      />

      {loadState === "loading" ? <p className="text-xs text-slate-500">Yükleniyor...</p> : null}
      {loadState === "error" ? <p className="text-xs text-rose-600">Çeviriler yüklenemedi.</p> : null}

      <div className="grid gap-4">
        {fields.map((fieldKey) => {
          const value = overrides[fieldKey] ?? "";
          const hasOverride = value.trim().length > 0;

          return (
            <div key={fieldKey} className="grid gap-1">
              <TextAreaField
                label={`${BUILDER_FIELD_LABELS[fieldKey as keyof typeof BUILDER_FIELD_LABELS] ?? fieldKey} — ${locale}`}
                onChange={(next) => handleFieldChange(fieldKey, next)}
                rows={2}
                value={value}
              />
              <p className="text-xs leading-5 text-slate-500">
                Varsayılan dil içeriği: {defaultValues[fieldKey]?.trim() || "—"}
              </p>
              {!hasOverride ? (
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-600">
                  Bu dilde çeviri yok — ziyaretçiye varsayılan dil gösterilir
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-3">
        <SectionActionButton
          label={saveState === "saving" ? "Kaydediliyor..." : "Çeviriyi kaydet"}
          disabled={saveState === "saving" || loadState === "loading"}
          onClick={() => void handleSave()}
        />
        {saveMessage ? (
          <span className={`text-xs ${saveState === "error" ? "text-rose-600" : "text-emerald-600"}`}>
            {saveMessage}
          </span>
        ) : null}
      </div>
    </InspectorGroup>
  );
}

function PanelCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InspectorGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</h4>
      <div className="mt-4 grid gap-3">{children}</div>
    </section>
  );
}

function FieldFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FieldFrame label={label}>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        type="text"
        value={value}
      />
    </FieldFrame>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <FieldFrame label={label}>
      <textarea
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400"
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        value={value}
      />
    </FieldFrame>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <FieldFrame label={label}>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value || 0))}
        type="number"
        value={value}
      />
    </FieldFrame>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FieldFrame label={label}>
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
      {children}
    </span>
  );
}

function SegmentButton({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className={[
        "rounded-full border px-4 py-2 text-sm font-semibold transition",
        active
          ? "border-slate-950 bg-slate-950 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
        disabled ? "cursor-not-allowed opacity-40 hover:border-slate-200 hover:bg-white" : "",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function SectionActionButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "destructive";
}) {
  return (
    <button
      className={[
        "inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-semibold uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-40",
        tone === "destructive"
          ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
      ].join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function textValue(record: JsonRecord, key: string, fallback = "") {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function numberValue(record: JsonRecord, key: string, fallback = 0) {
  const value = record[key];
  return typeof value === "number" ? value : fallback;
}
