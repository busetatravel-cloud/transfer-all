"use client";

import type { MouseEvent, ReactNode } from "react";
import { BuilderFallback } from "@/components/builder/primitives";
import { ResponsivePreviewFrame, type PreviewMode } from "@/components/builder/responsive-preview-frame";
import { ThemeStyleProvider } from "@/components/theme/theme-style-provider";
import type { EditableSection } from "@/lib/builder/editable-section";
import { resolvePreviewData } from "@/lib/builder/preview-data-adapter";
import { getBlockDefinition } from "@/lib/builder/registry";
import { getPageContainerWidthPx, type WorkspacePage } from "@/lib/builder/workspace-state";
import type { BuilderSection } from "@/lib/builder/types";
import type { ThemeSettings } from "@/lib/theme-types";

// Live Preview — Website Builder admin ekranının ORTA sütunu. Faz 5'teki
// SectionPreview/PagePreview ile AYNI güvenli-sınır deseni: her section
// düz fonksiyon olarak çağrılır, hata try/catch ile yakalanır, tek bir
// section'ın sorunu tüm önizlemeyi çökertmez.
//
// Faz 5'ten FARKI: kaynak veri donmuş bir template seed'i değil, kullanıcının
// o an düzenlediği `EditableSection[]` state'idir — hiçbir DB/registry
// yazımı yapılmaz, yalnızca render girdisidir.

export function LivePreview({
  sections,
  themeSettings,
  pageSettings,
  selectedSectionId,
  mode = "desktop",
  onSelectSection,
  onReorderSection,
}: {
  sections: EditableSection[];
  themeSettings: ThemeSettings;
  pageSettings: Pick<
    WorkspacePage,
    "active" | "backgroundMode" | "bottomSpacing" | "containerWidth" | "sectionGap" | "topSpacing" | "title"
  >;
  selectedSectionId: string | null;
  mode?: PreviewMode;
  onSelectSection?: (sectionId: string) => void;
  onReorderSection?: (fromId: string, toId: string) => void;
}) {
  if (!pageSettings.active) {
    return <BuilderFallback reason={`${pageSettings.title} sayfasi pasif durumda.`} />;
  }

  const containerWidth = getPageContainerWidthPx(pageSettings.containerWidth);

  const activeSections = [...sections]
    .filter((section) => section.active)
    .sort((a, b) => a.position - b.position);

  if (sections.length === 0) {
    return <BuilderFallback reason="Bu sayfada henüz hiçbir section yok." />;
  }

  if (activeSections.length === 0) {
    return <BuilderFallback reason="Tüm section'lar şu anda pasif durumda." />;
  }

  return (
    <ResponsivePreviewFrame mode={mode}>
      <ThemeStyleProvider
        settings={themeSettings}
        dir="ltr"
        lang="tr"
        className="min-h-[480px] bg-[var(--ps-background)] text-[var(--ps-text)]"
      >
        <div
          className={[
            "min-h-[480px]",
            pageSettings.backgroundMode === "dark"
              ? "bg-slate-950 text-white"
              : pageSettings.backgroundMode === "soft"
                ? "bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]"
                : "bg-[var(--ps-background)] text-[var(--ps-text)]",
          ].join(" ")}
          onClickCapture={preventPreviewNavigation}
          style={{
            paddingBottom: `${pageSettings.bottomSpacing}px`,
            paddingTop: `${pageSettings.topSpacing}px`,
          }}
        >
          <div
            className="mx-auto flex w-full flex-col px-4"
            style={{
              gap: `${pageSettings.sectionGap}px`,
              maxWidth: typeof containerWidth === "number" ? `${containerWidth}px` : "100%",
            }}
          >
            {activeSections.map((section) => (
              <LiveSectionPreview
                key={section.id}
                section={section}
                isSelected={section.id === selectedSectionId}
                onSelectSection={onSelectSection}
                onReorderSection={onReorderSection}
              />
            ))}
          </div>
        </div>
      </ThemeStyleProvider>
    </ResponsivePreviewFrame>
  );
}

function preventPreviewNavigation(event: MouseEvent<HTMLDivElement>) {
  const target = event.target as HTMLElement | null;

  if (target?.closest("a, button")) {
    event.preventDefault();
  }
}

function LiveSectionPreview({
  section,
  isSelected,
  onSelectSection,
  onReorderSection,
}: {
  section: EditableSection;
  isSelected: boolean;
  onSelectSection?: (sectionId: string) => void;
  onReorderSection?: (fromId: string, toId: string) => void;
}) {
  const definition = getBlockDefinition(section.blockKey);

  if (!definition) {
    return <BuilderFallback reason={`Bilinmeyen blok: "${section.blockKey}"`} />;
  }

  const runtimeSection: BuilderSection = {
    id: section.id,
    businessId: "builder-preview",
    pageId: "builder-preview",
    blockKey: section.blockKey,
    variantKey: section.variantKey,
    position: section.position,
    active: section.active,
    content: section.content,
    style: section.style,
    responsive: section.responsive,
    createdAt: "",
    updatedAt: "",
  };

  const previewData = resolvePreviewData(section.blockKey, section.content);

  let rendered: ReactNode;
  try {
    rendered = definition.PreviewRenderer({
      section: runtimeSection,
      breakpoint: "desktop",
      data: previewData as undefined,
    }) as ReactNode;
  } catch (error) {
    rendered = (
      <definition.Fallback
        reason={`Bu section render edilirken bir hata oluştu: ${error instanceof Error ? error.message : "bilinmeyen hata"}`}
      />
    );
  }

  return (
    <div
      aria-selected={isSelected}
      className={`relative rounded-[28px] transition ${
        isSelected ? "outline outline-2 outline-offset-4 outline-sky-500" : "hover:outline hover:outline-1 hover:outline-slate-300"
      }`}
      data-builder-section-id={section.id}
      data-builder-block={section.blockKey}
      draggable={Boolean(onReorderSection)}
      onClick={() => onSelectSection?.(section.id)}
      onDragStart={(event) => {
        if (!onReorderSection) {
          return;
        }

        event.dataTransfer.setData("text/plain", section.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        if (!onReorderSection) {
          return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!onReorderSection) {
          return;
        }

        event.preventDefault();
        const fromId = event.dataTransfer.getData("text/plain");

        if (fromId && fromId !== section.id) {
          onReorderSection(fromId, section.id);
        }
      }}
    >
      {isSelected ? (
        <div className="pointer-events-none absolute -top-3 left-4 rounded-full bg-sky-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white shadow-sm">
          Selected
        </div>
      ) : null}
      {rendered}
    </div>
  );
}
