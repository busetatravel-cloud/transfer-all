import { BuilderCard, BuilderContainer, BuilderFallback, BuilderHeading, BuilderImage, BuilderText } from "@/components/builder/primitives";
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
// Routes Showcase — Faz 14.
//
// ServicesGrid/VehicleShowcase ile AYNI mimari: content yalnızca
// başlık/ayar metinleri taşır, GERÇEK rota listesi mevcut business_routes
// CRUD'undan `data` prop'u üzerinden gelir.
//
// ÖNEMLİ KISIT (mevcut şema): business_routes tablosunda (bkz.
// lib/business-panel.ts BusinessRouteRecord) ayrı başlangıç/bitiş,
// fiyat veya süre/mesafe alanları YOKTUR — yalnızca id/slug/title/
// description/sortOrder/active vardır (rota adı zaten "Havalimanı - Şehir
// Merkezi" gibi tek bir title string'i olarak tutulur). Bu yüzden
// `priceLabel`/`durationLabel` DATA alanları BİLEREK OPSİYONELDİR: gerçek
// (public) adaptör bunları dolduramaz, blok bu durumda o satırları
// sessizce GÖSTERMEZ. Yalnızca admin preview'daki ÖRNEK veri bu alanları
// gösterir (bkz. vehicle-showcase.tsx'teki aynı notun genişletilmiş hali).
//
// Faz 15 denetimi: business_routes de business_vehicles ile birebir aynı
// sekilde dogrulandi (bkz. vehicle-showcase.tsx'teki not) — hicbir
// migration'da baslangic/bitis/fiyat/sure/mesafe sutunu eklenmemis, ve
// `pricing_rules` tablosu buraya da FK ile bagli DEGIL (yalnizca serbest
// metin origin/destination eslesmesi). Bu yuzden ayni gerekceyle
// priceLabel/durationLabel gercek veriden ASLA uretilmiyor.
// ============================================================

export interface RouteShowcaseItem {
  id: string;
  title: string;
  description: string;
  href: string;
  imageSrc?: string;
  priceLabel?: string;
  durationLabel?: string;
}

export interface RouteShowcaseData {
  items: RouteShowcaseItem[];
}

export interface RouteShowcaseContent extends JsonRecord {
  eyebrow: string;
  title: string;
  description: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  maxItems: number;
}

export interface RouteShowcaseStyle extends JsonRecord {
  columns: number;
}

const ROUTE_SHOWCASE_VARIANTS = [
  { key: asVariantKey("grid"), label: "Izgara", description: "Rota kartlarından oluşan ızgara." },
];

function defaultRouteShowcaseContent(): RouteShowcaseContent {
  return {
    eyebrow: "Popüler Rotalar",
    title: "En çok tercih edilen transfer güzergahları",
    description: "Sık kullanılan güzergahlarımızdan bazıları.",
    emptyStateTitle: "Rota yok",
    emptyStateDescription: "Bu işletme için henüz rota kaydı girilmedi.",
    maxItems: 6,
  };
}

function defaultRouteShowcaseStyle(): RouteShowcaseStyle {
  return { columns: 3 };
}

function validateRouteShowcase(
  input: BlockValidationInput,
): BuilderValidationResult<RouteShowcaseContent, RouteShowcaseStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultRouteShowcaseContent();
  const fallbackStyle = defaultRouteShowcaseStyle();

  const content: RouteShowcaseContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    emptyStateTitle: readString(rawContent.emptyStateTitle, fallbackContent.emptyStateTitle, "content.emptyStateTitle", issues, { maxLength: 60 }),
    emptyStateDescription: readString(rawContent.emptyStateDescription, fallbackContent.emptyStateDescription, "content.emptyStateDescription", issues, { maxLength: 200 }),
    maxItems: readNumber(rawContent.maxItems, fallbackContent.maxItems, "content.maxItems", issues, { min: 1, max: 24 }),
  };

  const style: RouteShowcaseStyle = {
    columns: readNumber(rawStyle.columns, fallbackStyle.columns, "style.columns", issues, { min: 2, max: 4 }),
  };

  return { valid: issues.length === 0, issues, content, style };
}

const COLUMN_CLASS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

function RouteShowcaseView({
  section,
  data,
}: BlockRendererProps<RouteShowcaseContent, RouteShowcaseStyle, RouteShowcaseData | undefined>) {
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
              <a key={item.id} href={item.href} className="block rounded-[var(--ps-radius)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-primary)]">
                <BuilderCard className="ps-card overflow-hidden" padding="sm">
                  {item.imageSrc ? <BuilderImage alt={item.title} className="-m-4 mb-0 rounded-none rounded-t-[inherit]" src={item.imageSrc} /> : null}
                  <div className="flex flex-col p-4" style={{ gap: "var(--ps-space-sm)" }}>
                    <BuilderHeading level="h3" size="xl" className="ps-card-title">
                      {item.title}
                    </BuilderHeading>
                    <BuilderText size="sm" className="ps-card-text opacity-80">
                      {item.description}
                    </BuilderText>
                    {item.priceLabel || item.durationLabel ? (
                      <div className="flex flex-wrap gap-3 pt-1 opacity-70" style={{ fontSize: "var(--ps-font-size-sm)" }}>
                        {item.priceLabel ? <span>{item.priceLabel}</span> : null}
                        {item.durationLabel ? <span>{item.durationLabel}</span> : null}
                      </div>
                    ) : null}
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

export const routesShowcaseBlock: BlockDefinition<RouteShowcaseContent, RouteShowcaseStyle, RouteShowcaseData | undefined> = {
  key: asBlockKey("routes_showcase"),
  version: 1,
  label: "Rota Vitrini",
  description: "İşletmenin popüler transfer rotalarını görsel kartlarla listeler.",
  family: "routes",
  variants: ROUTE_SHOWCASE_VARIANTS,
  defaultContent: defaultRouteShowcaseContent,
  defaultStyle: defaultRouteShowcaseStyle,
  validate: validateRouteShowcase,
  PreviewRenderer: RouteShowcaseView,
  PublicRenderer: RouteShowcaseView,
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
    icon: "map",
    paletteGroup: "Rotalar",
    draggable: true,
  },
};

registerBlock(routesShowcaseBlock);
