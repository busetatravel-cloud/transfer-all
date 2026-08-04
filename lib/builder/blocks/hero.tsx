import { BuilderButton, BuilderContainer, BuilderFallback, BuilderHeading, BuilderText } from "@/components/builder/primitives";
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
import { readEnum, readHref, readString } from "@/lib/builder/validation";

// ============================================================
// Hero — referans implementasyon (Faz 3).
// Bu dosya HİÇBİR başka blok dosyasını import etmez; yalnızca nötr alt
// yapıyı (types/validation/primitives/registry) kullanır.
// ============================================================

export interface HeroContent extends JsonRecord {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  secondaryButtonText: string;
  secondaryButtonHref: string;
}

export interface HeroStyle extends JsonRecord {
  align: "left" | "center";
  overlay: "none" | "light" | "dark";
}

const HERO_ALIGN_VALUES = ["left", "center"] as const;
const HERO_OVERLAY_VALUES = ["none", "light", "dark"] as const;

const HERO_VARIANTS = [
  { key: asVariantKey("centered"), label: "Ortalanmış", description: "Tek sütun, ortalanmış başlık ve butonlar." },
  { key: asVariantKey("split"), label: "İki sütun", description: "Solda metin/butonlar, sağda görsel alanı." },
];

function defaultHeroContent(): HeroContent {
  return {
    eyebrow: "Transfer & Turizm",
    title: "Havalimanı ve otel transferinde güvenilir çözüm",
    subtitle: "Profesyonel şoförler, konforlu araçlar, zamanında transfer.",
    primaryButtonText: "Teklif al",
    primaryButtonHref: "/quote",
    secondaryButtonText: "İletişim",
    secondaryButtonHref: "/contact",
  };
}

function defaultHeroStyle(): HeroStyle {
  return {
    align: "left",
    overlay: "none",
  };
}

function validateHero(input: BlockValidationInput): BuilderValidationResult<HeroContent, HeroStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultHeroContent();
  const fallbackStyle = defaultHeroStyle();

  const content: HeroContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    subtitle: readString(rawContent.subtitle, fallbackContent.subtitle, "content.subtitle", issues, { maxLength: 240 }),
    primaryButtonText: readString(rawContent.primaryButtonText, fallbackContent.primaryButtonText, "content.primaryButtonText", issues, { maxLength: 40 }),
    primaryButtonHref: readHref(rawContent.primaryButtonHref, fallbackContent.primaryButtonHref, "content.primaryButtonHref", issues),
    secondaryButtonText: readString(rawContent.secondaryButtonText, fallbackContent.secondaryButtonText, "content.secondaryButtonText", issues, { maxLength: 40 }),
    secondaryButtonHref: readHref(rawContent.secondaryButtonHref, fallbackContent.secondaryButtonHref, "content.secondaryButtonHref", issues),
  };

  const style: HeroStyle = {
    align: readEnum(rawStyle.align, HERO_ALIGN_VALUES, fallbackStyle.align, "style.align", issues),
    overlay: readEnum(rawStyle.overlay, HERO_OVERLAY_VALUES, fallbackStyle.overlay, "style.overlay", issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function HeroView({ section }: BlockRendererProps<HeroContent, HeroStyle>) {
  const { content, style } = section;

  if (!content.title.trim()) {
    return <BuilderFallback reason="Hero başlığı henüz girilmedi." />;
  }

  const alignClass = style.align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <BuilderContainer>
      <div
        // ps-hero: [data-ps-theme="luxury"] altinda tanimli surface/border/
        // radius/shadow/padding kurallarini devreye sokar (bkz. app/globals.css).
        // Modern temada bu class icin hicbir CSS kurali yok, gorunum degismez.
        className={`ps-hero flex flex-col gap-4 ${alignClass}`}
        style={{ paddingBlock: "var(--ps-space-3xl)", gap: "var(--ps-space-md)" }}
      >
        {content.eyebrow ? (
          <BuilderText size="sm" className="uppercase tracking-[0.24em] text-[var(--ps-secondary)]">
            {content.eyebrow}
          </BuilderText>
        ) : null}
        <BuilderHeading level="h1" size="5xl" className="ps-hero-title text-[var(--ps-text)]">
          {content.title}
        </BuilderHeading>
        {content.subtitle ? (
          <BuilderText size="lg" className="max-w-2xl text-[var(--ps-text)] opacity-80">
            {content.subtitle}
          </BuilderText>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-2">
          {content.primaryButtonText ? (
            <BuilderButton href={content.primaryButtonHref} variant="primary">
              {content.primaryButtonText}
            </BuilderButton>
          ) : null}
          {content.secondaryButtonText ? (
            <BuilderButton href={content.secondaryButtonHref} variant="secondary">
              {content.secondaryButtonText}
            </BuilderButton>
          ) : null}
        </div>
      </div>
    </BuilderContainer>
  );
}

export const heroBlock: BlockDefinition<HeroContent, HeroStyle> = {
  key: asBlockKey("hero"),
  version: 1,
  label: "Hero",
  description: "Sayfanın en üstündeki ana karşılama alanı — başlık, alt başlık ve CTA butonları.",
  family: "hero",
  variants: HERO_VARIANTS,
  defaultContent: defaultHeroContent,
  defaultStyle: defaultHeroStyle,
  validate: validateHero,
  PreviewRenderer: HeroView,
  PublicRenderer: HeroView,
  Fallback: BuilderFallback,
  seoImpact: {
    headingLevel: "h1",
    isPrimaryContent: true,
  },
  responsiveCapabilities: {
    supportsVisibilityToggle: false, // hero bir sayfada olmazsa olmazdır, gizlenmesine izin verilmez
    supportsReorder: true,
    supportsContentOverride: true,
    supportsStyleOverride: true,
  },
  themeCompatibility: "all",
  dragDrop: {
    icon: "layout-hero",
    paletteGroup: "Hero",
    draggable: true,
  },
};

registerBlock(heroBlock);
