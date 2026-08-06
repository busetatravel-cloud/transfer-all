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
import { readArray, readBoolean, readEnum, readNumber, readString } from "@/lib/builder/validation";

// ============================================================
// FAQ — Faz 14. Tamamen builder içeriğiyle beslenir (gerçek bir "SSS"
// tablosu yok, dolayısıyla veri adaptörü gerekmez — Hero/CTA ile aynı
// "kendi kendine yeten blok" kategorisi).
//
// Accordion, İSTEMCİ JS OLMADAN yerel <details>/<summary> ile kurulur —
// bu hem "erişilebilir button/aria yapısı" (tarayıcı bunu native olarak
// klavye/screen-reader uyumlu hale getirir) hem de "gereksiz client JS yok"
// hedefini aynı anda karşılar. FAQPage structured data, dangerouslySetInnerHTML
// KULLANMADAN, <script> öğesinin düz metin child'ı olarak yazılır.
// ============================================================

export interface FaqItem extends JsonRecord {
  id: string;
  question: string;
  answer: string;
  active: boolean;
  order: number;
}

export interface FaqContent extends JsonRecord {
  eyebrow: string;
  title: string;
  description: string;
  items: FaqItem[];
}

export interface FaqStyle extends JsonRecord {
  layout: "single" | "two-column";
}

const FAQ_LAYOUT_VALUES = ["single", "two-column"] as const;
const MAX_FAQ_ITEMS = 20;

const FAQ_VARIANTS = [
  { key: asVariantKey("accordion"), label: "Akordeon", description: "Tıklanınca açılan soru/cevap listesi." },
];

function defaultFaqContent(): FaqContent {
  return {
    eyebrow: "Sıkça Sorulan Sorular",
    title: "Merak edilenler",
    description: "Transfer hizmetimizle ilgili en çok sorulan sorular.",
    items: [
      { id: "faq-1", question: "Rezervasyonumu ne kadar önceden yapmalıyım?", answer: "Uçuş bilgilerinizle birlikte en az birkaç saat önceden rezervasyon oluşturmanızı öneririz.", active: true, order: 0 },
      { id: "faq-2", question: "Uçuşum gecikirse ne olur?", answer: "Uçuş takibi yaparız, şoförünüz güncel iniş saatine göre sizi bekler.", active: true, order: 1 },
      { id: "faq-3", question: "Ödemeyi nasıl yapabilirim?", answer: "Rezervasyon sırasında veya araç içinde farklı ödeme seçenekleriyle ödeme yapabilirsiniz.", active: true, order: 2 },
    ],
  };
}

function defaultFaqStyle(): FaqStyle {
  return { layout: "single" };
}

function validateFaq(input: BlockValidationInput): BuilderValidationResult<FaqContent, FaqStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultFaqContent();
  const fallbackStyle = defaultFaqStyle();

  const items = readArray<FaqItem>(rawContent.items, "content.items", issues, {
    maxItems: MAX_FAQ_ITEMS,
    mapItem: (raw, index, itemIssues) => {
      const rawItem = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        id: readString(rawItem.id, `faq-${index}`, `content.items[${index}].id`, itemIssues, { maxLength: 80 }),
        question: readString(rawItem.question, "", `content.items[${index}].question`, itemIssues, { maxLength: 200 }),
        answer: readString(rawItem.answer, "", `content.items[${index}].answer`, itemIssues, { maxLength: 1000 }),
        active: readBoolean(rawItem.active, true),
        order: readNumber(rawItem.order, index, `content.items[${index}].order`, itemIssues, { min: 0, max: MAX_FAQ_ITEMS }),
      };
    },
  });

  const content: FaqContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    items,
  };

  const style: FaqStyle = {
    layout: readEnum(rawStyle.layout, FAQ_LAYOUT_VALUES, fallbackStyle.layout, "style.layout", issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function escapeJsonLd(json: string): string {
  return json.replace(/</g, "\\u003c");
}

function FaqView({ section }: BlockRendererProps<FaqContent, FaqStyle>) {
  const { content, style } = section;
  const activeItems = content.items
    .filter((item) => item.active && item.question.trim() && item.answer.trim())
    .sort((a, b) => a.order - b.order);

  if (activeItems.length === 0) {
    return <BuilderFallback reason="Henüz aktif bir SSS sorusu eklenmedi." />;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: activeItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  const columnsClass = style.layout === "two-column" ? "md:grid-cols-2" : "grid-cols-1";

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

        <div className={`grid gap-3 ${columnsClass}`}>
          {activeItems.map((item) => (
            <details
              key={item.id}
              className="group rounded-2xl border border-[color-mix(in_srgb,var(--ps-secondary)_25%,transparent)] bg-[var(--ps-surface)] p-4 text-[var(--ps-text)]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-secondary)] [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <span aria-hidden="true" className="shrink-0 transition-transform motion-reduce:transition-none group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="mt-3 opacity-80" style={{ fontSize: "var(--ps-font-size-sm)" }}>
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json">{escapeJsonLd(JSON.stringify(structuredData))}</script>
    </BuilderContainer>
  );
}

export const faqBlock: BlockDefinition<FaqContent, FaqStyle> = {
  key: asBlockKey("faq"),
  version: 1,
  label: "SSS",
  description: "Sıkça sorulan sorular — erişilebilir akordeon ve FAQPage structured data ile.",
  family: "content",
  variants: FAQ_VARIANTS,
  defaultContent: defaultFaqContent,
  defaultStyle: defaultFaqStyle,
  validate: validateFaq,
  PreviewRenderer: FaqView,
  PublicRenderer: FaqView,
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
    icon: "help-circle",
    paletteGroup: "İçerik",
    draggable: true,
  },
};

registerBlock(faqBlock);
