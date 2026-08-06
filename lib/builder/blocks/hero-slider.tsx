import { HeroSliderClient } from "@/components/builder/blocks-client/hero-slider-client";
import { BuilderButton, BuilderFallback, BuilderHeading, BuilderText } from "@/components/builder/primitives";
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
import { readArray, readBoolean, readEnum, readHref, readImageSrc, readNumber, readString } from "@/lib/builder/validation";

// ============================================================
// Hero Slider — Faz 14.
//
// SEO/performans ilkesi (talimat gereği): İLK SLAYT her zaman gerçek,
// görünür DOM içeriği olarak server-render edilir (JS'e bağımlı değildir);
// diğer slaytlar da DOM'dadır (crawlable) ama başlangıçta gizlidir. Slaytlar
// arası geçiş/otomatik oynatma DIŞINDA hiçbir şey client JS'e taşınmaz —
// gerçek slayt içeriği (başlık/CTA/görsel) HER ZAMAN burada, server
// tarafında üretilir ve hazır JSX olarak HeroSliderClient'a `children`
// olarak geçirilir (bkz. o dosyanın başındaki not).
//
// Tek bir sayfada birden fazla H1 SEO açısından hatalıdır — bu yüzden
// yalnızca ilk (aktif) slaytın başlığı gerçek <h1>'dir, diğer slaytların
// başlıkları görsel olarak AYNI görünen ama semantik olarak başlık
// olmayan bir <p> ile render edilir.
// ============================================================

export interface HeroSlide extends JsonRecord {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  desktopImageSrc: string;
  mobileImageSrc: string;
  primaryButtonText: string;
  primaryButtonHref: string;
  secondaryButtonText: string;
  secondaryButtonHref: string;
  align: "left" | "center";
  overlay: "none" | "light" | "dark";
  active: boolean;
  order: number;
}

export interface HeroSliderContent extends JsonRecord {
  slides: HeroSlide[];
}

export interface HeroSliderStyle extends JsonRecord {
  autoplay: boolean;
  durationMs: number;
  pauseOnHover: boolean;
  transition: "fade" | "slide";
  showIndicators: boolean;
  showArrows: boolean;
  loop: boolean;
}

const MAX_SLIDES = 8;
const HERO_SLIDE_ALIGN_VALUES = ["left", "center"] as const;
const HERO_SLIDE_OVERLAY_VALUES = ["none", "light", "dark"] as const;
const HERO_SLIDER_TRANSITION_VALUES = ["fade", "slide"] as const;

const HERO_SLIDER_VARIANTS = [
  { key: asVariantKey("fullwidth"), label: "Tam genişlik", description: "Görsel arka planlı, tam genişlikte slayt gösterisi." },
];

function defaultHeroSlide(id: string, order: number, title: string, subtitle: string): HeroSlide {
  return {
    id,
    title,
    subtitle,
    description: "",
    desktopImageSrc: "",
    mobileImageSrc: "",
    primaryButtonText: "Teklif al",
    primaryButtonHref: "/quote",
    secondaryButtonText: "İletişim",
    secondaryButtonHref: "/contact",
    align: "left",
    overlay: "dark",
    active: true,
    order,
  };
}

function defaultHeroSliderContent(): HeroSliderContent {
  return {
    slides: [
      defaultHeroSlide("slide-0", 0, "Havalimanı ve otel transferinde güvenilir çözüm", "Profesyonel şoförler, konforlu araçlar, zamanında transfer."),
      defaultHeroSlide("slide-1", 1, "Şehirler arası konforlu yolculuk", "Geniş araç filomuzla her ihtiyaca uygun transfer seçeneği."),
    ],
  };
}

function defaultHeroSliderStyle(): HeroSliderStyle {
  return {
    autoplay: true,
    durationMs: 6000,
    pauseOnHover: true,
    transition: "fade",
    showIndicators: true,
    showArrows: true,
    loop: true,
  };
}

function validateHeroSlider(input: BlockValidationInput): BuilderValidationResult<HeroSliderContent, HeroSliderStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackStyle = defaultHeroSliderStyle();

  const slides = readArray<HeroSlide>(rawContent.slides, "content.slides", issues, {
    maxItems: MAX_SLIDES,
    mapItem: (raw, index, itemIssues) => {
      const rawItem = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        id: readString(rawItem.id, `slide-${index}`, `content.slides[${index}].id`, itemIssues, { maxLength: 80 }),
        title: readString(rawItem.title, "", `content.slides[${index}].title`, itemIssues, { maxLength: 140 }),
        subtitle: readString(rawItem.subtitle, "", `content.slides[${index}].subtitle`, itemIssues, { maxLength: 240 }),
        description: readString(rawItem.description, "", `content.slides[${index}].description`, itemIssues, { maxLength: 300 }),
        desktopImageSrc: readImageSrc(rawItem.desktopImageSrc, "", `content.slides[${index}].desktopImageSrc`, itemIssues),
        mobileImageSrc: readImageSrc(rawItem.mobileImageSrc, "", `content.slides[${index}].mobileImageSrc`, itemIssues),
        primaryButtonText: readString(rawItem.primaryButtonText, "", `content.slides[${index}].primaryButtonText`, itemIssues, { maxLength: 40 }),
        primaryButtonHref: readHref(rawItem.primaryButtonHref, "/quote", `content.slides[${index}].primaryButtonHref`, itemIssues),
        secondaryButtonText: readString(rawItem.secondaryButtonText, "", `content.slides[${index}].secondaryButtonText`, itemIssues, { maxLength: 40 }),
        secondaryButtonHref: readHref(rawItem.secondaryButtonHref, "/contact", `content.slides[${index}].secondaryButtonHref`, itemIssues),
        align: readEnum(rawItem.align, HERO_SLIDE_ALIGN_VALUES, "left", `content.slides[${index}].align`, itemIssues),
        overlay: readEnum(rawItem.overlay, HERO_SLIDE_OVERLAY_VALUES, "dark", `content.slides[${index}].overlay`, itemIssues),
        active: readBoolean(rawItem.active, true),
        order: readNumber(rawItem.order, index, `content.slides[${index}].order`, itemIssues, { min: 0, max: MAX_SLIDES }),
      };
    },
  });

  const content: HeroSliderContent = { slides };

  const style: HeroSliderStyle = {
    autoplay: readBoolean(rawStyle.autoplay, fallbackStyle.autoplay),
    durationMs: readNumber(rawStyle.durationMs, fallbackStyle.durationMs, "style.durationMs", issues, { min: 1500, max: 20000 }),
    pauseOnHover: readBoolean(rawStyle.pauseOnHover, fallbackStyle.pauseOnHover),
    transition: readEnum(rawStyle.transition, HERO_SLIDER_TRANSITION_VALUES, fallbackStyle.transition, "style.transition", issues),
    showIndicators: readBoolean(rawStyle.showIndicators, fallbackStyle.showIndicators),
    showArrows: readBoolean(rawStyle.showArrows, fallbackStyle.showArrows),
    loop: readBoolean(rawStyle.loop, fallbackStyle.loop),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function SlideContent({ slide, isFirst }: { slide: HeroSlide; isFirst: boolean }) {
  const alignClass = slide.align === "center" ? "items-center text-center" : "items-start text-left";
  const overlayClass =
    slide.overlay === "dark" ? "bg-black/50" : slide.overlay === "light" ? "bg-white/40" : "bg-transparent";
  const textColorClass = slide.overlay === "light" ? "text-slate-950" : "text-white";

  return (
    <div className="relative flex h-full w-full items-center overflow-hidden bg-slate-900">
      {slide.desktopImageSrc ? (
        <img
          alt=""
          aria-hidden="true"
          className="absolute inset-0 hidden h-full w-full object-cover md:block"
          decoding="async"
          loading={isFirst ? "eager" : "lazy"}
          src={slide.desktopImageSrc}
        />
      ) : null}
      {slide.mobileImageSrc || slide.desktopImageSrc ? (
        <img
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 h-full w-full object-cover ${slide.desktopImageSrc ? "md:hidden" : ""}`}
          decoding="async"
          loading={isFirst ? "eager" : "lazy"}
          src={slide.mobileImageSrc || slide.desktopImageSrc}
        />
      ) : null}
      <div className={`absolute inset-0 ${overlayClass}`} />
      <div className={`relative z-10 flex w-full flex-col gap-4 px-6 py-16 md:px-16 ${alignClass} ${textColorClass}`}>
        {slide.subtitle ? (
          <BuilderText size="sm" className="uppercase tracking-[0.24em] opacity-90">
            {slide.subtitle}
          </BuilderText>
        ) : null}
        {isFirst ? (
          <BuilderHeading level="h1" size="5xl" className="ps-hero-title">
            {slide.title}
          </BuilderHeading>
        ) : (
          <p className="font-semibold tracking-tight" style={{ fontSize: "var(--ps-font-size-5xl)", lineHeight: "var(--ps-line-height-5xl)" }}>
            {slide.title}
          </p>
        )}
        {slide.description ? (
          <BuilderText size="lg" className="max-w-2xl opacity-90">
            {slide.description}
          </BuilderText>
        ) : null}
        <div className="flex flex-wrap gap-3 pt-2">
          {slide.primaryButtonText ? (
            <BuilderButton href={slide.primaryButtonHref} variant="primary">
              {slide.primaryButtonText}
            </BuilderButton>
          ) : null}
          {slide.secondaryButtonText ? (
            <BuilderButton href={slide.secondaryButtonHref} variant="secondary">
              {slide.secondaryButtonText}
            </BuilderButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function HeroSliderView({ section }: BlockRendererProps<HeroSliderContent, HeroSliderStyle>) {
  const { content, style } = section;
  const activeSlides = content.slides.filter((slide) => slide.active && slide.title.trim()).sort((a, b) => a.order - b.order);

  if (activeSlides.length === 0) {
    return <BuilderFallback reason="Henüz aktif bir slayt eklenmedi." />;
  }

  if (activeSlides.length === 1) {
    return (
      <div className="ps-hero overflow-hidden rounded-[28px]" style={{ minHeight: "clamp(420px, 60vh, 640px)" }}>
        <SlideContent isFirst slide={activeSlides[0]} />
      </div>
    );
  }

  return (
    <div className="ps-hero">
      <HeroSliderClient
        autoplay={style.autoplay}
        durationMs={style.durationMs}
        loop={style.loop}
        pauseOnHover={style.pauseOnHover}
        showArrows={style.showArrows}
        showIndicators={style.showIndicators}
        slides={activeSlides.map((slide, index) => (
          <SlideContent isFirst={index === 0} key={slide.id} slide={slide} />
        ))}
        transition={style.transition}
      />
    </div>
  );
}

export const heroSliderBlock: BlockDefinition<HeroSliderContent, HeroSliderStyle> = {
  key: asBlockKey("hero_slider"),
  version: 1,
  label: "Hero Slider",
  description: "Birden fazla slayt içeren, otomatik oynatılabilen tam genişlik hero.",
  family: "hero",
  variants: HERO_SLIDER_VARIANTS,
  defaultContent: defaultHeroSliderContent,
  defaultStyle: defaultHeroSliderStyle,
  validate: validateHeroSlider,
  PreviewRenderer: HeroSliderView,
  PublicRenderer: HeroSliderView,
  Fallback: BuilderFallback,
  seoImpact: {
    headingLevel: "h1",
    isPrimaryContent: true,
  },
  responsiveCapabilities: {
    supportsVisibilityToggle: false,
    supportsReorder: true,
    supportsContentOverride: true,
    supportsStyleOverride: true,
  },
  themeCompatibility: "all",
  dragDrop: {
    icon: "layout-hero-slider",
    paletteGroup: "Hero",
    draggable: true,
  },
};

registerBlock(heroSliderBlock);
