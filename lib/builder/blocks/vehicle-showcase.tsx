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
// Vehicle Showcase — Faz 14.
//
// ServicesGrid ile AYNI mimari: content yalnızca başlık/ayar metinleri
// taşır, GERÇEK araç listesi mevcut business_vehicles CRUD'undan `data`
// prop'u üzerinden gelir (bkz. public-data-adapter.ts).
//
// ÖNEMLİ KISIT (mevcut şema): business_vehicles tablosunda (bkz.
// lib/business-panel.ts BusinessVehicleRecord) kapasite/bagaj alanları
// YOKTUR — yalnızca id/slug/title/description/sortOrder/active vardır. Bu
// yüzden `capacity`/`luggage` DATA alanları BİLEREK OPSİYONELDİR: gerçek
// (public) adaptör bunları hiçbir zaman dolduramaz ve blok bu durumda o
// satırları sessizce GÖSTERMEZ (uydurma rakam YOK). Yalnızca admin
// preview'daki ÖRNEK veri (preview-data-adapter.ts) bu alanları gösterir —
// bu, işletme sahibine "bu bilgi eklenirse nasıl görüneceğini" göstermek
// içindir, gerçek ziyaretçiye ASLA sızmaz. Yeni migration bu fazda YASAK
// olduğu için gerçek kapasite/bagaj alanları ileriki bir faza bırakılmıştır
// (bkz. final rapor "Riskler").
//
// Faz 15 denetimi: supabase/migrations/0001_init.sql ve production schema
// snapshot'ı (supabase/snapshots/production-schema-snapshot.sql) taranarak
// dogrulandi — business_vehicles tablosuna HICBIR migration'da kapasite/
// bagaj/fiyat/sure sutunu eklenmemis (yalnizca id/business_id/slug/title/
// description/sort_order/active/created_at/updated_at var). Ayri bir
// `pricing_rules` tablosu VAR ama business genelinde, origin/destination/
// vehicle_category gibi SERBEST METIN alanlarla eslesen bir kurallar
// motorudur — belirli bir arac satirina foreign key ile BAGLI DEGILDIR.
// Bu tabloya karsi "en yakin eslesen kural"i tahmin ederek bir fiyat
// uretmek, ayni sekilde uydurma veri sayilir (yanlis/eksik eslesirse
// ziyaretciye hatali fiyat gosterilebilir) — bu yuzden BILEREK yapilmadi.
// ============================================================

export interface VehicleShowcaseItem {
  id: string;
  title: string;
  description: string;
  href: string;
  imageSrc?: string;
  capacity?: string;
  luggage?: string;
}

export interface VehicleShowcaseData {
  items: VehicleShowcaseItem[];
}

export interface VehicleShowcaseContent extends JsonRecord {
  eyebrow: string;
  title: string;
  description: string;
  emptyStateTitle: string;
  emptyStateDescription: string;
  maxItems: number;
}

export interface VehicleShowcaseStyle extends JsonRecord {
  columns: number;
}

const VEHICLE_SHOWCASE_VARIANTS = [
  { key: asVariantKey("grid"), label: "Izgara", description: "Araç kartlarından oluşan ızgara." },
];

function defaultVehicleShowcaseContent(): VehicleShowcaseContent {
  return {
    eyebrow: "Araç Filomuz",
    title: "İhtiyacınıza uygun aracı seçin",
    description: "Konforlu ve bakımlı araçlarımızla güvenli bir yolculuk.",
    emptyStateTitle: "Araç yok",
    emptyStateDescription: "Bu işletme için henüz araç kaydı girilmedi.",
    maxItems: 6,
  };
}

function defaultVehicleShowcaseStyle(): VehicleShowcaseStyle {
  return { columns: 3 };
}

function validateVehicleShowcase(
  input: BlockValidationInput,
): BuilderValidationResult<VehicleShowcaseContent, VehicleShowcaseStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultVehicleShowcaseContent();
  const fallbackStyle = defaultVehicleShowcaseStyle();

  const content: VehicleShowcaseContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    emptyStateTitle: readString(rawContent.emptyStateTitle, fallbackContent.emptyStateTitle, "content.emptyStateTitle", issues, { maxLength: 60 }),
    emptyStateDescription: readString(rawContent.emptyStateDescription, fallbackContent.emptyStateDescription, "content.emptyStateDescription", issues, { maxLength: 200 }),
    maxItems: readNumber(rawContent.maxItems, fallbackContent.maxItems, "content.maxItems", issues, { min: 1, max: 24 }),
  };

  const style: VehicleShowcaseStyle = {
    columns: readNumber(rawStyle.columns, fallbackStyle.columns, "style.columns", issues, { min: 2, max: 4 }),
  };

  return { valid: issues.length === 0, issues, content, style };
}

const COLUMN_CLASS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

function VehicleShowcaseView({
  section,
  data,
}: BlockRendererProps<VehicleShowcaseContent, VehicleShowcaseStyle, VehicleShowcaseData | undefined>) {
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
                    {item.capacity || item.luggage ? (
                      <div className="flex flex-wrap gap-3 pt-1 opacity-70" style={{ fontSize: "var(--ps-font-size-sm)" }}>
                        {item.capacity ? <span>{item.capacity}</span> : null}
                        {item.luggage ? <span>{item.luggage}</span> : null}
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

export const vehicleShowcaseBlock: BlockDefinition<VehicleShowcaseContent, VehicleShowcaseStyle, VehicleShowcaseData | undefined> = {
  key: asBlockKey("vehicle_showcase"),
  version: 1,
  label: "Araç Vitrini",
  description: "İşletmenin araçlarını görsel kartlarla listeler.",
  family: "vehicles",
  variants: VEHICLE_SHOWCASE_VARIANTS,
  defaultContent: defaultVehicleShowcaseContent,
  defaultStyle: defaultVehicleShowcaseStyle,
  validate: validateVehicleShowcase,
  PreviewRenderer: VehicleShowcaseView,
  PublicRenderer: VehicleShowcaseView,
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
    icon: "car",
    paletteGroup: "Araçlar",
    draggable: true,
  },
};

registerBlock(vehicleShowcaseBlock);
