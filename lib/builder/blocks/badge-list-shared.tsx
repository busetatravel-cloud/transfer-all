import { BuilderContainer, BuilderFallback, BuilderHeading, BuilderImage, BuilderText } from "@/components/builder/primitives";
import type {
  BlockDefinition,
  BlockKey,
  BlockRendererProps,
  BlockValidationInput,
  BlockVariantDefinition,
  BuilderValidationIssue,
  BuilderValidationResult,
  JsonRecord,
} from "@/lib/builder/types";
import { asVariantKey } from "@/lib/builder/types";
import { readArray, readBoolean, readHref, readImageSrc, readString } from "@/lib/builder/validation";

// ============================================================
// Trust Badges ve Partners/Logos — Faz 14.
//
// İki ayrı block_key olarak kayıt olurlar (registry'de iki BAĞIMSIZ blok
// gibi görünürler, admin paletinde iki ayrı giriş) ama şemaları/render
// mantıkları BİREBİR AYNI (logo + label + href + alt + monochrome/color +
// grid/carousel) — bu yüzden kod TEK bir yerde (bu dosyada) yazılır ve iki
// registerBlock() çağrısı (bkz. trust-badges.tsx / partners.tsx) buradan
// somut BlockDefinition üretir. Bu, hero.tsx'in "başka bir blok dosyasını
// import etmez" ilkesini BOZMAZ: trust-badges.tsx ve partners.tsx birbirini
// import ETMEZ, ikisi de bu nötr paylaşılan modüle (primitives.tsx/
// validation.ts ile aynı kategoride) bağımlıdır.
// ============================================================

export interface BadgeItem extends JsonRecord {
  id: string;
  label: string;
  logoSrc: string;
  href: string;
  altText: string;
  active: boolean;
  order: number;
}

export interface BadgeListContent extends JsonRecord {
  eyebrow: string;
  title: string;
  items: BadgeItem[];
}

export interface BadgeListStyle extends JsonRecord {
  mode: "color" | "monochrome";
}

const MAX_BADGE_ITEMS = 16;

export const BADGE_LIST_VARIANTS: BlockVariantDefinition[] = [
  { key: asVariantKey("grid"), label: "Izgara", description: "Logolar bir ızgarada yan yana." },
  { key: asVariantKey("carousel"), label: "Kaydırmalı", description: "Yatayda kaydırılabilir logo şeridi." },
];

export function defaultBadgeListContent(eyebrow: string, title: string, sample: Array<{ label: string }>): BadgeListContent {
  return {
    eyebrow,
    title,
    items: sample.map((entry, index) => ({
      id: `badge-${index}`,
      label: entry.label,
      logoSrc: "",
      href: "",
      altText: entry.label,
      active: true,
      order: index,
    })),
  };
}

export function defaultBadgeListStyle(): BadgeListStyle {
  return { mode: "color" };
}

export function validateBadgeList(input: BlockValidationInput): BuilderValidationResult<BadgeListContent, BadgeListStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;

  const items = readArray<BadgeItem>(rawContent.items, "content.items", issues, {
    maxItems: MAX_BADGE_ITEMS,
    mapItem: (raw, index, itemIssues) => {
      const rawItem = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      const label = readString(rawItem.label, "", `content.items[${index}].label`, itemIssues, { maxLength: 60 });
      return {
        id: readString(rawItem.id, `badge-${index}`, `content.items[${index}].id`, itemIssues, { maxLength: 80 }),
        label,
        logoSrc: readImageSrc(rawItem.logoSrc, "", `content.items[${index}].logoSrc`, itemIssues),
        href: readHref(rawItem.href, "", `content.items[${index}].href`, itemIssues),
        altText: readString(rawItem.altText, label, `content.items[${index}].altText`, itemIssues, { maxLength: 120 }),
        active: readBoolean(rawItem.active, true),
        order: readNumberSafe(rawItem.order, index, `content.items[${index}].order`, itemIssues),
      };
    },
  });

  const content: BadgeListContent = {
    eyebrow: readString(rawContent.eyebrow, "", "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, "", "content.title", issues, { maxLength: 140 }),
    items,
  };

  const style: BadgeListStyle = {
    mode: readModeEnum(rawStyle.mode, issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function readNumberSafe(value: unknown, fallback: number, path: string, issues: BuilderValidationIssue[]): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_BADGE_ITEMS) {
    return value;
  }
  issues.push({ path, message: "Sayı bekleniyor, varsayılan sıra kullanıldı." });
  return fallback;
}

function readModeEnum(value: unknown, issues: BuilderValidationIssue[]): "color" | "monochrome" {
  if (value === "color" || value === "monochrome") {
    return value;
  }
  issues.push({ path: "style.mode", message: "Geçersiz değer, izin verilenler: color, monochrome." });
  return "color";
}

function BadgeCard({ item, mode }: { item: BadgeItem; mode: BadgeListStyle["mode"] }) {
  const inner = (
    <div className={`flex h-16 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--ps-secondary)_20%,transparent)] bg-[var(--ps-surface)] px-4 transition motion-reduce:transition-none ${mode === "monochrome" ? "grayscale hover:grayscale-0" : ""}`}>
      {item.logoSrc ? (
        <BuilderImage alt={item.altText} aspectRatio="3/1" fit="contain" src={item.logoSrc} />
      ) : (
        <span className="truncate text-sm font-semibold opacity-70">{item.label}</span>
      )}
    </div>
  );

  if (!item.href) {
    return inner;
  }

  return (
    <a
      aria-label={item.altText}
      className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-primary)]"
      href={item.href}
    >
      {inner}
    </a>
  );
}

export function BadgeListView({
  section,
  emptyReason,
}: BlockRendererProps<BadgeListContent, BadgeListStyle> & { emptyReason: string }) {
  const { content, style, variantKey } = section;
  const activeItems = content.items.filter((item) => item.active && (item.logoSrc || item.label)).sort((a, b) => a.order - b.order);

  if (activeItems.length === 0) {
    return <BuilderFallback reason={emptyReason} />;
  }

  const isCarousel = String(variantKey) === "carousel";

  return (
    <BuilderContainer>
      <div className="flex flex-col" style={{ gap: "var(--ps-space-lg)" }}>
        {content.eyebrow ? (
          <BuilderText size="sm" className="uppercase tracking-[0.24em] text-[var(--ps-secondary)]">
            {content.eyebrow}
          </BuilderText>
        ) : null}
        {content.title ? (
          <BuilderHeading level="h2" size="2xl" className="ps-heading text-[var(--ps-text)]">
            {content.title}
          </BuilderHeading>
        ) : null}

        {isCarousel ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {activeItems.map((item) => (
              <div className="w-[160px] shrink-0 snap-center" key={item.id}>
                <BadgeCard item={item} mode={style.mode} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {activeItems.map((item) => (
              <BadgeCard item={item} key={item.id} mode={style.mode} />
            ))}
          </div>
        )}
      </div>
    </BuilderContainer>
  );
}

export function buildBadgeListBlock(options: {
  key: BlockKey;
  label: string;
  description: string;
  family: string;
  defaultEyebrow: string;
  defaultTitle: string;
  defaultItems: Array<{ label: string }>;
  emptyReason: string;
  icon: string;
  paletteGroup: string;
}): BlockDefinition<BadgeListContent, BadgeListStyle> {
  function View(props: BlockRendererProps<BadgeListContent, BadgeListStyle>) {
    return BadgeListView({ ...props, emptyReason: options.emptyReason });
  }

  return {
    key: options.key,
    version: 1,
    label: options.label,
    description: options.description,
    family: options.family,
    variants: BADGE_LIST_VARIANTS,
    defaultContent: () => defaultBadgeListContent(options.defaultEyebrow, options.defaultTitle, options.defaultItems),
    defaultStyle: defaultBadgeListStyle,
    validate: validateBadgeList,
    PreviewRenderer: View,
    PublicRenderer: View,
    Fallback: BuilderFallback,
    seoImpact: {
      headingLevel: "none",
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
      icon: options.icon,
      paletteGroup: options.paletteGroup,
      draggable: true,
    },
  };
}
