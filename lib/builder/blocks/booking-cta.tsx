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
import { readBoolean, readEnum, readHref, readString } from "@/lib/builder/validation";

// ============================================================
// Booking CTA — Faz 14.
//
// CTA (cta.tsx) ile aynı ailede ama İKİ EK, GERÇEK kanal barındırır:
// WhatsApp ve telefon. Bu iki butonun HEDEF NUMARASI asla builder
// content'inden (serbest metin) gelmez — yalnızca `data` prop'u üzerinden,
// o an oturum açmış işletmenin GERÇEK business.phone/business.whatsapp
// alanlarından (bkz. public-data-adapter.ts) sağlanır. Content yalnızca bu
// butonların GÖRÜNÜP görünmeyeceğini ve buton METNİNİ yönetir — tenant
// verisi (gerçek numara) hiçbir zaman client'tan/serbest metinden alınmaz.
// ============================================================

export interface BookingCtaData {
  whatsappHref: string | null;
  phoneHref: string | null;
}

export interface BookingCtaContent extends JsonRecord {
  title: string;
  description: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  showWhatsapp: boolean;
  whatsappButtonText: string;
  showPhone: boolean;
  phoneButtonText: string;
}

export interface BookingCtaStyle extends JsonRecord {
  tone: "brand" | "surface";
}

const BOOKING_CTA_TONE_VALUES = ["brand", "surface"] as const;

const BOOKING_CTA_VARIANTS = [
  { key: asVariantKey("centered"), label: "Ortalanmış", description: "Tek sütun, ortalanmış rezervasyon çağrısı." },
];

function defaultBookingCtaContent(): BookingCtaContent {
  return {
    title: "Hemen rezervasyon yapın",
    description: "Uçuş bilgilerinizi paylaşın, size en uygun transfer seçeneğini birkaç dakika içinde sunalım.",
    primaryButtonText: "Rezervasyon Yap",
    primaryButtonHref: "/booking",
    showWhatsapp: true,
    whatsappButtonText: "WhatsApp'tan yaz",
    showPhone: true,
    phoneButtonText: "Hemen ara",
  };
}

function defaultBookingCtaStyle(): BookingCtaStyle {
  return { tone: "brand" };
}

function validateBookingCta(input: BlockValidationInput): BuilderValidationResult<BookingCtaContent, BookingCtaStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultBookingCtaContent();
  const fallbackStyle = defaultBookingCtaStyle();

  const content: BookingCtaContent = {
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 120 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    primaryButtonText: readString(rawContent.primaryButtonText, fallbackContent.primaryButtonText, "content.primaryButtonText", issues, { maxLength: 40 }),
    primaryButtonHref: readHref(rawContent.primaryButtonHref, fallbackContent.primaryButtonHref, "content.primaryButtonHref", issues),
    showWhatsapp: readBoolean(rawContent.showWhatsapp, fallbackContent.showWhatsapp),
    whatsappButtonText: readString(rawContent.whatsappButtonText, fallbackContent.whatsappButtonText, "content.whatsappButtonText", issues, { maxLength: 40 }),
    showPhone: readBoolean(rawContent.showPhone, fallbackContent.showPhone),
    phoneButtonText: readString(rawContent.phoneButtonText, fallbackContent.phoneButtonText, "content.phoneButtonText", issues, { maxLength: 40 }),
  };

  const style: BookingCtaStyle = {
    tone: readEnum(rawStyle.tone, BOOKING_CTA_TONE_VALUES, fallbackStyle.tone, "style.tone", issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function BookingCtaView({ section, data }: BlockRendererProps<BookingCtaContent, BookingCtaStyle, BookingCtaData | undefined>) {
  const { content, style } = section;

  if (!content.title.trim()) {
    return <BuilderFallback reason="Booking CTA başlığı henüz girilmedi." />;
  }

  const toneClass =
    style.tone === "brand" ? "bg-[var(--ps-primary)] text-[var(--ps-background)]" : "bg-[var(--ps-surface)] text-[var(--ps-text)]";
  const secondaryVariant = style.tone === "brand" ? "secondary" : "primary";

  const whatsappHref = content.showWhatsapp ? data?.whatsappHref ?? null : null;
  const phoneHref = content.showPhone ? data?.phoneHref ?? null : null;

  return (
    <BuilderContainer>
      <div
        className={`flex flex-col items-center gap-4 text-center ${toneClass}`}
        style={{ padding: "var(--ps-space-2xl)", borderRadius: "var(--ps-radius)", boxShadow: "var(--ps-shadow)" }}
      >
        <BuilderHeading level="h2" size="3xl">
          {content.title}
        </BuilderHeading>
        {content.description ? (
          <BuilderText size="base" className="max-w-xl opacity-90">
            {content.description}
          </BuilderText>
        ) : null}
        <div className="flex flex-wrap justify-center gap-3">
          {content.primaryButtonText ? (
            <BuilderButton href={content.primaryButtonHref} variant={style.tone === "brand" ? "secondary" : "primary"}>
              {content.primaryButtonText}
            </BuilderButton>
          ) : null}
          {whatsappHref ? (
            <BuilderButton href={whatsappHref} variant={secondaryVariant}>
              {content.whatsappButtonText}
            </BuilderButton>
          ) : null}
          {phoneHref ? (
            <BuilderButton href={phoneHref} variant={secondaryVariant}>
              {content.phoneButtonText}
            </BuilderButton>
          ) : null}
        </div>
      </div>
    </BuilderContainer>
  );
}

export const bookingCtaBlock: BlockDefinition<BookingCtaContent, BookingCtaStyle, BookingCtaData | undefined> = {
  key: asBlockKey("booking_cta"),
  version: 1,
  label: "Rezervasyon Çağrısı",
  description: "Güçlü bir rezervasyon çağrısı — gerçek WhatsApp ve telefon numaralarıyla.",
  family: "cta",
  variants: BOOKING_CTA_VARIANTS,
  defaultContent: defaultBookingCtaContent,
  defaultStyle: defaultBookingCtaStyle,
  validate: validateBookingCta,
  PreviewRenderer: BookingCtaView,
  PublicRenderer: BookingCtaView,
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
    icon: "calendar-check",
    paletteGroup: "Diğer",
    draggable: true,
  },
};

registerBlock(bookingCtaBlock);
