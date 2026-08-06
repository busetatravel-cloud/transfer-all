import { BuilderContainer, BuilderFallback, BuilderHeading, BuilderImage, BuilderText } from "@/components/builder/primitives";
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
import { readArray, readBoolean, readImageSrc, readNumber, readString } from "@/lib/builder/validation";

// ============================================================
// Testimonials / Reviews — Faz 14.
//
// Bu repo'da gerçek bir "yorum/puan" tablosu (business_reviews vb.) YOK
// (grep ile doğrulandı) — bu yüzden bu blok, talimattaki "yoksa builder
// içeriği kullanılabilir" dalını kullanır: içerik tamamen builder'da elle
// girilir, gerçek bir veri adaptörü YOKTUR (Hero/CTA ile aynı kategori).
// İleride gerçek bir yorum kaynağı eklenirse, yalnızca public-data-adapter.ts
// içine yeni bir dal eklenir; bu dosyanın şeması değişmez.
//
// "carousel" varyantı HİÇBİR client JS OLMADAN, saf CSS scroll-snap ile
// kurulur (overflow-x-auto + snap-x) — dokunmatik/trackpad ile kaydırılabilir,
// performans hedefi "gereksiz client JS yok"u karşılar.
// ============================================================

export interface TestimonialItem extends JsonRecord {
  id: string;
  name: string;
  quote: string;
  rating: number;
  location: string;
  avatarSrc: string;
  date: string;
  active: boolean;
  order: number;
}

export interface TestimonialsContent extends JsonRecord {
  eyebrow: string;
  title: string;
  items: TestimonialItem[];
}

export interface TestimonialsStyle extends JsonRecord {
  columns: number;
}

const MAX_TESTIMONIAL_ITEMS = 12;

const TESTIMONIALS_VARIANTS = [
  { key: asVariantKey("grid"), label: "Izgara", description: "Kartlar bir ızgarada yan yana." },
  { key: asVariantKey("carousel"), label: "Kaydırmalı", description: "Yatayda kaydırılabilir kart şeridi." },
];

function defaultTestimonialsContent(): TestimonialsContent {
  return {
    eyebrow: "Müşteri Yorumları",
    title: "Bize güvenenler ne diyor?",
    items: [
      { id: "review-1", name: "Ahmet Y.", quote: "Zamanında geldiler, araç çok temizdi. Kesinlikle tavsiye ederim.", rating: 5, location: "İstanbul", avatarSrc: "", date: "", active: true, order: 0 },
      { id: "review-2", name: "Elena K.", quote: "Very professional driver, smooth airport pickup.", rating: 5, location: "Antalya", avatarSrc: "", date: "", active: true, order: 1 },
      { id: "review-3", name: "Mehmet A.", quote: "Fiyat performans olarak çok iyi bir hizmet.", rating: 4, location: "İzmir", avatarSrc: "", date: "", active: true, order: 2 },
    ],
  };
}

function defaultTestimonialsStyle(): TestimonialsStyle {
  return { columns: 3 };
}

function validateTestimonials(
  input: BlockValidationInput,
): BuilderValidationResult<TestimonialsContent, TestimonialsStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultTestimonialsContent();
  const fallbackStyle = defaultTestimonialsStyle();

  const items = readArray<TestimonialItem>(rawContent.items, "content.items", issues, {
    maxItems: MAX_TESTIMONIAL_ITEMS,
    mapItem: (raw, index, itemIssues) => {
      const rawItem = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        id: readString(rawItem.id, `review-${index}`, `content.items[${index}].id`, itemIssues, { maxLength: 80 }),
        name: readString(rawItem.name, "", `content.items[${index}].name`, itemIssues, { maxLength: 80 }),
        quote: readString(rawItem.quote, "", `content.items[${index}].quote`, itemIssues, { maxLength: 400 }),
        rating: readNumber(rawItem.rating, 5, `content.items[${index}].rating`, itemIssues, { min: 1, max: 5 }),
        location: readString(rawItem.location, "", `content.items[${index}].location`, itemIssues, { maxLength: 80 }),
        avatarSrc: readImageSrc(rawItem.avatarSrc, "", `content.items[${index}].avatarSrc`, itemIssues),
        date: readString(rawItem.date, "", `content.items[${index}].date`, itemIssues, { maxLength: 40 }),
        active: readBoolean(rawItem.active, true),
        order: readNumber(rawItem.order, index, `content.items[${index}].order`, itemIssues, { min: 0, max: MAX_TESTIMONIAL_ITEMS }),
      };
    },
  });

  const content: TestimonialsContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    items,
  };

  const style: TestimonialsStyle = {
    columns: readNumber(rawStyle.columns, fallbackStyle.columns, "style.columns", issues, { min: 2, max: 4 }),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div aria-label={`${rating} / 5 yıldız`} className="flex gap-0.5 text-[var(--ps-secondary)]" role="img">
      {Array.from({ length: 5 }, (_, index) => (
        <svg aria-hidden="true" fill={index < rating ? "currentColor" : "none"} height="16" key={index} stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" width="16">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

function TestimonialCard({ item }: { item: TestimonialItem }) {
  return (
    <article className="ps-card flex flex-col gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--ps-secondary)_25%,transparent)] bg-[var(--ps-surface)] p-5 text-[var(--ps-text)]">
      <StarRating rating={item.rating} />
      <p className="opacity-90" style={{ fontSize: "var(--ps-font-size-sm)" }}>
        &ldquo;{item.quote}&rdquo;
      </p>
      <div className="mt-auto flex items-center gap-3 pt-2">
        {item.avatarSrc ? (
          <BuilderImage alt={item.name} aspectRatio="1/1" className="w-10 shrink-0 rounded-full" src={item.avatarSrc} />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ps-primary)] font-semibold text-[var(--ps-background)]">
            {item.name.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0">
          <div className="truncate font-semibold">{item.name}</div>
          {item.location ? <div className="truncate opacity-60" style={{ fontSize: "var(--ps-font-size-sm)" }}>{item.location}</div> : null}
        </div>
      </div>
    </article>
  );
}

const COLUMN_CLASS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

function TestimonialsView({ section }: BlockRendererProps<TestimonialsContent, TestimonialsStyle>) {
  const { content, style, variantKey } = section;
  const activeItems = content.items.filter((item) => item.active && item.quote.trim() && item.name.trim()).sort((a, b) => a.order - b.order);

  if (activeItems.length === 0) {
    return <BuilderFallback reason="Henüz aktif bir müşteri yorumu eklenmedi." />;
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
        <BuilderHeading level="h2" size="3xl" className="ps-heading text-[var(--ps-text)]">
          {content.title}
        </BuilderHeading>

        {isCarousel ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {activeItems.map((item) => (
              <div className="w-[280px] shrink-0 snap-center" key={item.id}>
                <TestimonialCard item={item} />
              </div>
            ))}
          </div>
        ) : (
          <div className={`grid gap-4 ${COLUMN_CLASS[style.columns] ?? COLUMN_CLASS[3]}`}>
            {activeItems.map((item) => (
              <TestimonialCard item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </BuilderContainer>
  );
}

export const testimonialsBlock: BlockDefinition<TestimonialsContent, TestimonialsStyle> = {
  key: asBlockKey("testimonials"),
  version: 1,
  label: "Müşteri Yorumları",
  description: "Müşteri yorumları ve puanları — ızgara veya kaydırmalı görünüm.",
  family: "content",
  variants: TESTIMONIALS_VARIANTS,
  defaultContent: defaultTestimonialsContent,
  defaultStyle: defaultTestimonialsStyle,
  validate: validateTestimonials,
  PreviewRenderer: TestimonialsView,
  PublicRenderer: TestimonialsView,
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
    icon: "quote",
    paletteGroup: "İçerik",
    draggable: true,
  },
};

registerBlock(testimonialsBlock);
