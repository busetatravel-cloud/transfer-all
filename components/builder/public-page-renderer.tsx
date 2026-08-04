import type { ReactNode } from "react";
import { getBlockDefinition } from "@/lib/builder/registry";
import { resolvePublicBlockData } from "@/lib/builder/public-data-adapter";
import type { EditableSection } from "@/lib/builder/editable-section";
import { getPageContainerWidthPx, type WorkspacePage } from "@/lib/builder/workspace-state";
import type { BuilderSection, JsonRecord } from "@/lib/builder/types";
import type { BusinessPanelData } from "@/lib/business-panel";

// ============================================================
// Faz 11 — gercek public sitede builder sayfasini render eden katman.
//
// components/builder/section-preview.tsx (Faz 5) ile AYNI guvenli-sinir
// deseni: her section duz fonksiyon olarak cagrilir, hata try/catch ile
// yakalanir. FARK: burasi GERCEK ziyaretcilere gosterilir, bu yuzden
// section-preview.tsx'in aksine hicbir zaman admin-icin yazilmis hata/debug
// metni ("Bu section render edilirken bir hata olustu" vb.) GOSTERMEZ —
// bozuk/bilinmeyen bir section sessizce ATLANIR (null doner), boylece tek bir
// bozuk section public sayfayi asla cirkin bir hata kutusuyla doldurmaz.
// ============================================================

const HREF_FIELDS_BY_BLOCK: Record<string, string[]> = {
  hero: ["primaryButtonHref", "secondaryButtonHref"],
  cta: ["primaryButtonHref"],
};

export function withLocaleIfInternal(href: string, locale: string): string {
  if (!href.startsWith("/")) {
    // mailto:, tel:, https://, "#anchor" gibi degerlere dokunma — yalnizca
    // ayni-site goreli yollara locale ekleriz.
    return href;
  }

  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}lang=${encodeURIComponent(locale)}`;
}

export function localizeHrefFields(blockKey: string, content: JsonRecord, locale: string): JsonRecord {
  const fields = HREF_FIELDS_BY_BLOCK[blockKey];

  if (!fields) {
    return content;
  }

  const next: JsonRecord = { ...content };

  for (const field of fields) {
    const value = next[field];
    if (typeof value === "string" && value) {
      next[field] = withLocaleIfInternal(value, locale);
    }
  }

  return next;
}

export function PublicBuilderPageContent({
  page,
  panel,
  locale,
}: {
  page: WorkspacePage;
  panel: BusinessPanelData;
  locale: string;
}) {
  const activeSections = [...page.sections]
    .filter((section) => section.active)
    .sort((a, b) => a.position - b.position);

  if (activeSections.length === 0) {
    return null;
  }

  // Sayfa duzen ayarlari (containerWidth/backgroundMode/spacing) —
  // components/builder/admin/live-preview.tsx'teki (Faz 10) admin
  // onizlemesiyle AYNI mantik, boylece tenant'in builder'da gordugu ile
  // gercek public sitede gordugu birebir eslesir. PublicSiteShell'in kendi
  // <main> genisligi (max-w-6xl) disaridan sabit kaldigi icin containerWidth
  // yalnizca o alan icinde bir ust sinir olarak calisir — mevcut public
  // sayfalarin genel duzeni degismez.
  const containerWidth = getPageContainerWidthPx(page.containerWidth);
  const backgroundClass =
    page.backgroundMode === "dark"
      ? "bg-slate-950 text-white"
      : page.backgroundMode === "soft"
        ? "bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_42%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]"
        : "bg-[var(--ps-background)] text-[var(--ps-text)]";

  return (
    <div
      className={backgroundClass}
      style={{ paddingTop: `${page.topSpacing}px`, paddingBottom: `${page.bottomSpacing}px` }}
    >
      <div
        className="mx-auto flex w-full flex-col"
        style={{
          gap: `${page.sectionGap}px`,
          maxWidth: typeof containerWidth === "number" ? `${containerWidth}px` : "100%",
        }}
      >
        {activeSections.map((section) => (
          <PublicBuilderSection key={section.id} page={page} panel={panel} locale={locale} section={section} />
        ))}
      </div>
    </div>
  );
}

function PublicBuilderSection({
  page,
  panel,
  locale,
  section,
}: {
  page: WorkspacePage;
  panel: BusinessPanelData;
  locale: string;
  section: EditableSection;
}) {
  const definition = getBlockDefinition(section.blockKey);

  // Bilinmeyen/kaldirilmis bir blok tanimi (registry drift) — ziyaretciye
  // hicbir sey gostermeden sessizce atla. Bu, publish anindaki
  // re-validation'in yakalayamadigi (ör. publish SONRASI bir kod
  // deploy'unda blok kaldirilmissa) son bir savunma katmanidir.
  if (!definition) {
    return null;
  }

  const content = localizeHrefFields(String(section.blockKey), section.content, locale);

  const runtimeSection: BuilderSection = {
    id: section.id,
    businessId: panel.business?.id ?? "",
    pageId: page.id,
    blockKey: section.blockKey,
    variantKey: section.variantKey,
    position: section.position,
    active: section.active,
    content,
    style: section.style,
    responsive: section.responsive,
    createdAt: "",
    updatedAt: "",
  };

  const data = resolvePublicBlockData(section.blockKey, content, panel, { pageKey: page.key });

  try {
    return definition.PublicRenderer({
      section: runtimeSection,
      breakpoint: "desktop",
      data: data as undefined,
    }) as ReactNode;
  } catch (error) {
    console.warn("public builder section render failed, skipping section", {
      businessId: panel.business?.id ?? "",
      pageId: page.id,
      sectionId: section.id,
      blockKey: String(section.blockKey),
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
