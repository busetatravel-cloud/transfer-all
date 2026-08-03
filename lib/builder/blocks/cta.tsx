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
// CTA (Call to Action) — referans implementasyon (Faz 3).
// Hero/ServicesGrid'den tamamen bağımsız; yalnızca nötr alt yapıyı kullanır.
// ============================================================

export interface CtaContent extends JsonRecord {
  title: string;
  description: string;
  primaryButtonText: string;
  primaryButtonHref: string;
}

export interface CtaStyle extends JsonRecord {
  tone: "brand" | "surface";
}

const CTA_TONE_VALUES = ["brand", "surface"] as const;

const CTA_VARIANTS = [
  { key: asVariantKey("centered"), label: "Ortalanmış", description: "Tek sütun, ortalanmış çağrı bloğu." },
];

function defaultCtaContent(): CtaContent {
  return {
    title: "Şimdi teklif isteyin",
    description: "Uçuş bilgilerinizi paylaşın, 15 dakika içinde size dönelim.",
    primaryButtonText: "Teklif al",
    primaryButtonHref: "/quote",
  };
}

function defaultCtaStyle(): CtaStyle {
  return {
    tone: "brand",
  };
}

function validateCta(input: BlockValidationInput): BuilderValidationResult<CtaContent, CtaStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultCtaContent();
  const fallbackStyle = defaultCtaStyle();

  const content: CtaContent = {
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 120 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    primaryButtonText: readString(rawContent.primaryButtonText, fallbackContent.primaryButtonText, "content.primaryButtonText", issues, { maxLength: 40 }),
    primaryButtonHref: readHref(rawContent.primaryButtonHref, fallbackContent.primaryButtonHref, "content.primaryButtonHref", issues),
  };

  const style: CtaStyle = {
    tone: readEnum(rawStyle.tone, CTA_TONE_VALUES, fallbackStyle.tone, "style.tone", issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function CtaView({ section }: BlockRendererProps<CtaContent, CtaStyle>) {
  const { content, style } = section;

  if (!content.title.trim()) {
    return <BuilderFallback reason="CTA başlığı henüz girilmedi." />;
  }

  const toneClass =
    style.tone === "brand"
      ? "bg-[var(--ps-primary)] text-[var(--ps-background)]"
      : "bg-[var(--ps-surface)] text-[var(--ps-text)]";

  return (
    <BuilderContainer>
      <div
        className={`flex flex-col items-center gap-4 text-center ${toneClass}`}
        style={{
          padding: "var(--ps-space-2xl)",
          borderRadius: "var(--ps-radius)",
          boxShadow: "var(--ps-shadow)",
        }}
      >
        <BuilderHeading level="h2" size="3xl">
          {content.title}
        </BuilderHeading>
        {content.description ? (
          <BuilderText size="base" className="max-w-xl opacity-90">
            {content.description}
          </BuilderText>
        ) : null}
        {content.primaryButtonText ? (
          <BuilderButton href={content.primaryButtonHref} variant={style.tone === "brand" ? "secondary" : "primary"}>
            {content.primaryButtonText}
          </BuilderButton>
        ) : null}
      </div>
    </BuilderContainer>
  );
}

export const ctaBlock: BlockDefinition<CtaContent, CtaStyle> = {
  key: asBlockKey("cta"),
  version: 1,
  label: "CTA",
  description: "Sayfa içinde tek bir eyleme yönlendiren vurgulu çağrı bloğu.",
  family: "cta",
  variants: CTA_VARIANTS,
  defaultContent: defaultCtaContent,
  defaultStyle: defaultCtaStyle,
  validate: validateCta,
  PreviewRenderer: CtaView,
  PublicRenderer: CtaView,
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
    icon: "megaphone",
    paletteGroup: "Diğer",
    draggable: true,
  },
};

registerBlock(ctaBlock);
