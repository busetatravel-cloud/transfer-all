import { BuilderContainer, BuilderFallback, BuilderHeading, BuilderText } from "@/components/builder/primitives";
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
import { readArray, readBoolean, readNumber, readString } from "@/lib/builder/validation";

// ============================================================
// Statistics — Faz 14. Tamamen builder içeriğiyle beslenir (transfer
// sayısı/mutlu müşteri/araç sayısı/yıl deneyimi gibi rakamlar gerçek bir
// sayım tablosundan DEĞİL, işletmenin kendi beyan ettiği değerlerden gelir
// — bu yüzden veri adaptörü yok, Hero/CTA ile aynı kategori).
//
// `animateOnScroll` bilinçli olarak İNERT bir metadata alanıdır: bu fazda
// hiçbir sayaç animasyonu JS'i YAZILMAZ (talimat: "ilk sürümde ağır JS
// ekleme"). Alan yalnızca ileride bir client-side "count up" efekti
// eklendiğinde okunacak şekilde şimdiden şemaya girer.
// ============================================================

export interface StatItem extends JsonRecord {
  id: string;
  value: number;
  suffix: string;
  label: string;
  order: number;
  active: boolean;
}

export interface StatisticsContent extends JsonRecord {
  eyebrow: string;
  title: string;
  items: StatItem[];
  animateOnScroll: boolean;
}

export interface StatisticsStyle extends JsonRecord {
  columns: number;
  tone: "surface" | "brand";
}

const MAX_STAT_ITEMS = 8;
const STATISTICS_TONE_VALUES = ["surface", "brand"] as const;

const STATISTICS_VARIANTS = [
  { key: asVariantKey("row"), label: "Tek sıra", description: "Rakamlar tek bir yatay sırada." },
];

function defaultStatisticsContent(): StatisticsContent {
  return {
    eyebrow: "Rakamlarla Biz",
    title: "Güvenle tercih ediliyoruz",
    animateOnScroll: false,
    items: [
      { id: "stat-1", value: 15000, suffix: "+", label: "Tamamlanan transfer", order: 0, active: true },
      { id: "stat-2", value: 4800, suffix: "+", label: "Mutlu müşteri", order: 1, active: true },
      { id: "stat-3", value: 25, suffix: "+", label: "Araç filosu", order: 2, active: true },
      { id: "stat-4", value: 8, suffix: "", label: "Yıllık deneyim", order: 3, active: true },
    ],
  };
}

function defaultStatisticsStyle(): StatisticsStyle {
  return { columns: 4, tone: "surface" };
}

function validateStatistics(input: BlockValidationInput): BuilderValidationResult<StatisticsContent, StatisticsStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultStatisticsContent();
  const fallbackStyle = defaultStatisticsStyle();

  const items = readArray<StatItem>(rawContent.items, "content.items", issues, {
    maxItems: MAX_STAT_ITEMS,
    mapItem: (raw, index, itemIssues) => {
      const rawItem = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        id: readString(rawItem.id, `stat-${index}`, `content.items[${index}].id`, itemIssues, { maxLength: 80 }),
        value: readNumber(rawItem.value, 0, `content.items[${index}].value`, itemIssues, { min: 0, max: 10_000_000 }),
        suffix: readString(rawItem.suffix, "", `content.items[${index}].suffix`, itemIssues, { maxLength: 8 }),
        label: readString(rawItem.label, "", `content.items[${index}].label`, itemIssues, { maxLength: 80 }),
        order: readNumber(rawItem.order, index, `content.items[${index}].order`, itemIssues, { min: 0, max: MAX_STAT_ITEMS }),
        active: readBoolean(rawItem.active, true),
      };
    },
  });

  const content: StatisticsContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    animateOnScroll: readBoolean(rawContent.animateOnScroll, fallbackContent.animateOnScroll),
    items,
  };

  const style: StatisticsStyle = {
    columns: readNumber(rawStyle.columns, fallbackStyle.columns, "style.columns", issues, { min: 2, max: 5 }),
    tone: readEnumTone(rawStyle.tone, fallbackStyle.tone, issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function readEnumTone(value: unknown, fallback: "surface" | "brand", issues: BuilderValidationIssue[]): "surface" | "brand" {
  if (typeof value === "string" && (STATISTICS_TONE_VALUES as readonly string[]).includes(value)) {
    return value as "surface" | "brand";
  }
  issues.push({ path: "style.tone", message: `Geçersiz değer, izin verilenler: ${STATISTICS_TONE_VALUES.join(", ")}.` });
  return fallback;
}

const COLUMN_CLASS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-5",
};

function formatStatValue(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(Math.round(value));
}

function StatisticsView({ section }: BlockRendererProps<StatisticsContent, StatisticsStyle>) {
  const { content, style } = section;
  const activeItems = content.items.filter((item) => item.active && item.label.trim()).sort((a, b) => a.order - b.order);

  if (activeItems.length === 0) {
    return <BuilderFallback reason="Henüz aktif bir istatistik eklenmedi." />;
  }

  const toneClass =
    style.tone === "brand" ? "bg-[var(--ps-primary)] text-[var(--ps-background)]" : "bg-[var(--ps-surface)] text-[var(--ps-text)]";

  return (
    <BuilderContainer>
      <div className="flex flex-col" style={{ gap: "var(--ps-space-lg)" }}>
        {content.eyebrow ? (
          <BuilderText size="sm" className="uppercase tracking-[0.24em] text-[var(--ps-secondary)]">
            {content.eyebrow}
          </BuilderText>
        ) : null}
        {content.title ? (
          <BuilderHeading level="h2" size="3xl" className="ps-heading text-[var(--ps-text)]">
            {content.title}
          </BuilderHeading>
        ) : null}

        <div className={`grid gap-4 ${COLUMN_CLASS[style.columns] ?? COLUMN_CLASS[4]}`}>
          {activeItems.map((item) => (
            <div
              key={item.id}
              className={`flex flex-col items-center gap-1 rounded-2xl p-6 text-center ${toneClass}`}
              // data-ps-stat-animate: bu fazda hicbir JS bu attribute'u okumaz;
              // yalnizca ileride eklenecek "count up" efekti icin hazir bir kanca.
              data-ps-stat-animate={content.animateOnScroll ? "true" : "false"}
            >
              <span className="text-4xl font-bold tracking-tight">
                {formatStatValue(item.value)}
                {item.suffix}
              </span>
              <span className="opacity-80" style={{ fontSize: "var(--ps-font-size-sm)" }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </BuilderContainer>
  );
}

export const statisticsBlock: BlockDefinition<StatisticsContent, StatisticsStyle> = {
  key: asBlockKey("statistics"),
  version: 1,
  label: "İstatistikler",
  description: "Transfer sayısı, mutlu müşteri, araç filosu gibi güven veren rakamlar.",
  family: "content",
  variants: STATISTICS_VARIANTS,
  defaultContent: defaultStatisticsContent,
  defaultStyle: defaultStatisticsStyle,
  validate: validateStatistics,
  PreviewRenderer: StatisticsView,
  PublicRenderer: StatisticsView,
  Fallback: BuilderFallback,
  seoImpact: {
    headingLevel: "h2",
    isPrimaryContent: false,
  },
  responsiveCapabilities: {
    supportsVisibilityToggle: true,
    supportsReorder: true,
    supportsContentOverride: true,
    supportsStyleOverride: true,
  },
  themeCompatibility: "all",
  dragDrop: {
    icon: "bar-chart",
    paletteGroup: "İçerik",
    draggable: true,
  },
};

registerBlock(statisticsBlock);
