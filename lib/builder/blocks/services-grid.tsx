import { BuilderCard, BuilderContainer, BuilderFallback, BuilderHeading, BuilderText } from "@/components/builder/primitives";
import { registerBlock } from "@/lib/builder/registry";
import {
  asBlockKey,
  asVariantKey,
  type BlockDefinition,
  type BlockRendererProps,
  type BlockValidationInput,
  type BuilderValidationIssue,
  type BuilderValidationResult,
  type JsonRecord,
} from "@/lib/builder/types";
import { readNumber, readString } from "@/lib/builder/validation";

// ============================================================
// ServicesGrid — referans implementasyon (Faz 3).
//
// Bu blok, mevcut business_services CRUD'unu DEĞİŞTİRMEZ — yalnızca o
// içeriğin bir sayfada NASIL gösterileceğini yönetir. Bu yüzden kendi
// content'i yalnızca BAŞLIK/ETİKET metinlerini taşır; gerçek hizmet
// listesi `data` prop'u üzerinden (bu bloğa ÖZEL, minimal bir görünüm
// modeliyle) dışarıdan sağlanır — mevcut BusinessServiceRecord'a veya
// başka bir bloğa bağımlılık YOKTUR, yalnızca kendi ihtiyaç duyduğu
// alanları (id/title/description/href/imageSrc) tanımlar. Sayfa render
// pipeline'ı (ileriki bir faz) gerçek veriyi bu şekle eşler.
// ============================================================

export interface ServicesGridItem {
  id: string;
  title: string;
  description: string;
  href: string;
  imageSrc?: string;
}

export interface ServicesGridData {
  items: ServicesGridItem[];
}

export interface ServicesGridContent extends JsonRecord {
  eyebrow: string;
  title: string;
  description: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  maxItems: number;
}

export interface ServicesGridStyle extends JsonRecord {
  columns: number;
}

const SERVICES_GRID_VARIANTS = [
  { key: asVariantKey("grid"), label: "Izgara", description: "Eşit genişlikte kartlardan oluşan ızgara." },
];

function defaultServicesGridContent(): ServicesGridContent {
  return {
    eyebrow: "Hizmetler",
    title: "Temel transfer hizmetleri",
    description: "İşletmenizin sunduğu transfer hizmetleri.",
    emptyStateTitle: "Hizmet yok",
    emptyStateDescription: "Bu işletme için henüz hizmet kaydı girilmedi.",
    maxItems: 6,
  };
}

function defaultServicesGridStyle(): ServicesGridStyle {
  return {
    columns: 3,
  };
}

function validateServicesGrid(
  input: BlockValidationInput,
): BuilderValidationResult<ServicesGridContent, ServicesGridStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultServicesGridContent();
  const fallbackStyle = defaultServicesGridStyle();

  const content: ServicesGridContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    emptyStateTitle: readString(rawContent.emptyStateTitle, fallbackContent.emptyStateTitle, "content.emptyStateTitle", issues, { maxLength: 60 }),
    emptyStateDescription: readString(rawContent.emptyStateDescription, fallbackContent.emptyStateDescription, "content.emptyStateDescription", issues, { maxLength: 200 }),
    maxItems: readNumber(rawContent.maxItems, fallbackContent.maxItems, "content.maxItems", issues, { min: 1, max: 24 }),
  };

  const style: ServicesGridStyle = {
    columns: readNumber(rawStyle.columns, fallbackStyle.columns, "style.columns", issues, { min: 2, max: 4 }),
  };

  return { valid: issues.length === 0, issues, content, style };
}

const COLUMN_CLASS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

function ServicesGridView({
  section,
  data,
}: BlockRendererProps<ServicesGridContent, ServicesGridStyle, ServicesGridData | undefined>) {
  const { content, style } = section;
  const items = (data?.items ?? []).slice(0, content.maxItems);

  return (
    <BuilderContainer>
      <div className="flex flex-col" style={{ gap: "var(--ps-space-lg)" }}>
        {content.eyebrow ? (
          <BuilderText size="sm" className="uppercase tracking-[0.24em] text-[var(--ps-secondary)]">
            {content.eyebrow}
          </BuilderText>
        ) : null}
        <BuilderHeading level="h2" size="3xl" className="ps-heading text-[var(--ps-text)]">
          {content.title}
        </BuilderHeading>
        {content.description ? (
          <BuilderText size="base" className="ps-subtext max-w-2xl text-[var(--ps-text)] opacity-80">
            {content.description}
          </BuilderText>
        ) : null}

        {items.length ? (
          <div className={`grid gap-4 ${COLUMN_CLASS[style.columns] ?? COLUMN_CLASS[3]}`}>
            {items.map((item) => (
              <a key={item.id} href={item.href} className="block">
                <BuilderCard className="ps-card">
                  <div className="flex flex-col" style={{ gap: "var(--ps-space-sm)" }}>
                    <BuilderHeading level="h3" size="xl" className="ps-card-title">
                      {item.title}
                    </BuilderHeading>
                    <BuilderText size="sm" className="ps-card-text opacity-80">
                      {item.description}
                    </BuilderText>
                  </div>
                </BuilderCard>
              </a>
            ))}
          </div>
        ) : (
          <BuilderFallback reason={content.emptyStateDescription || content.emptyStateTitle} />
        )}
      </div>
    </BuilderContainer>
  );
}

export const servicesGridBlock: BlockDefinition<ServicesGridContent, ServicesGridStyle, ServicesGridData | undefined> = {
  key: asBlockKey("services_grid"),
  version: 1,
  label: "Hizmetler Izgarası",
  description: "İşletmenin hizmetlerini kart ızgarası olarak listeler.",
  family: "services",
  variants: SERVICES_GRID_VARIANTS,
  defaultContent: defaultServicesGridContent,
  defaultStyle: defaultServicesGridStyle,
  validate: validateServicesGrid,
  PreviewRenderer: ServicesGridView,
  PublicRenderer: ServicesGridView,
  Fallback: BuilderFallback,
  seoImpact: {
    headingLevel: "h2",
    isPrimaryContent: true,
  },
  responsiveCapabilities: {
    supportsVisibilityToggle: true,
    supportsReorder: true,
    supportsContentOverride: true,
    supportsStyleOverride: true,
  },
  themeCompatibility: "all",
  dragDrop: {
    icon: "grid",
    paletteGroup: "Hizmetler",
    draggable: true,
  },
};

registerBlock(servicesGridBlock);
