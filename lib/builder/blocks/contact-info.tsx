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
import { readArray, readBoolean, readEnum, readHref, readString } from "@/lib/builder/validation";

// ============================================================
// Contact Info — Faz 14.
//
// Telefon/WhatsApp/e-posta GERÇEK business profiline bağlıdır — bu üç
// alanın DEĞERİ asla builder content'inden (serbest metin) gelmez, yalnızca
// `data` prop'u üzerinden o an oturum açmış işletmenin gerçek
// business.phone/whatsapp/email alanlarından sağlanır (bkz.
// public-data-adapter.ts). Content yalnızca bunların gösterilip
// gösterilmeyeceğini yönetir.
//
// Adres/çalışma saatleri/sosyal linkler için business tablosunda (bkz.
// lib/business.ts BusinessRecord) HİÇBİR alan YOKTUR — bunlar bilerek
// builder content'i olarak (işletmenin kendi girdiği serbest metin/link)
// tutulur; bu, gerçek olmayan veri üretmek DEĞİLDİR çünkü değerleri
// doğrudan tenant'ın kendisi giriyor (Contact sayfasındaki mevcut
// PublicQuoteForm'un adres alanı gibi bir CRUD'a bağlı değiller).
// ============================================================

export interface SocialLink extends JsonRecord {
  id: string;
  platform: string;
  href: string;
  active: boolean;
  order: number;
}

export interface ContactInfoData {
  phoneHref: string | null;
  phoneLabel: string | null;
  whatsappHref: string | null;
  emailHref: string | null;
  emailLabel: string | null;
}

export interface ContactInfoContent extends JsonRecord {
  eyebrow: string;
  title: string;
  address: string;
  hours: string;
  socialLinks: SocialLink[];
  showPhone: boolean;
  showWhatsapp: boolean;
  showEmail: boolean;
}

export interface ContactInfoStyle extends JsonRecord {
  layout: "stacked" | "columns";
}

const MAX_SOCIAL_LINKS = 8;
const CONTACT_INFO_LAYOUT_VALUES = ["stacked", "columns"] as const;

const CONTACT_INFO_VARIANTS = [
  { key: asVariantKey("card"), label: "Kart", description: "İletişim bilgileri tek bir kart içinde." },
];

function defaultContactInfoContent(): ContactInfoContent {
  return {
    eyebrow: "İletişim",
    title: "Bize ulaşın",
    address: "",
    hours: "Her gün 00:00 - 24:00",
    showPhone: true,
    showWhatsapp: true,
    showEmail: true,
    socialLinks: [],
  };
}

function defaultContactInfoStyle(): ContactInfoStyle {
  return { layout: "stacked" };
}

function validateContactInfo(input: BlockValidationInput): BuilderValidationResult<ContactInfoContent, ContactInfoStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultContactInfoContent();
  const fallbackStyle = defaultContactInfoStyle();

  const socialLinks = readArray<SocialLink>(rawContent.socialLinks, "content.socialLinks", issues, {
    maxItems: MAX_SOCIAL_LINKS,
    mapItem: (raw, index, itemIssues) => {
      const rawItem = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        id: readString(rawItem.id, `social-${index}`, `content.socialLinks[${index}].id`, itemIssues, { maxLength: 80 }),
        platform: readString(rawItem.platform, "", `content.socialLinks[${index}].platform`, itemIssues, { maxLength: 40 }),
        href: readHref(rawItem.href, "", `content.socialLinks[${index}].href`, itemIssues),
        active: readBoolean(rawItem.active, true),
        order: readIndexSafe(rawItem.order, index),
      };
    },
  });

  const content: ContactInfoContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    address: readString(rawContent.address, fallbackContent.address, "content.address", issues, { maxLength: 240 }),
    hours: readString(rawContent.hours, fallbackContent.hours, "content.hours", issues, { maxLength: 200 }),
    showPhone: readBoolean(rawContent.showPhone, fallbackContent.showPhone),
    showWhatsapp: readBoolean(rawContent.showWhatsapp, fallbackContent.showWhatsapp),
    showEmail: readBoolean(rawContent.showEmail, fallbackContent.showEmail),
    socialLinks,
  };

  const style: ContactInfoStyle = {
    layout: readEnum(rawStyle.layout, CONTACT_INFO_LAYOUT_VALUES, fallbackStyle.layout, "style.layout", issues),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function readIndexSafe(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function ContactInfoView({ section, data }: BlockRendererProps<ContactInfoContent, ContactInfoStyle, ContactInfoData | undefined>) {
  const { content, style } = section;

  const phoneHref = content.showPhone ? data?.phoneHref ?? null : null;
  const whatsappHref = content.showWhatsapp ? data?.whatsappHref ?? null : null;
  const emailHref = content.showEmail ? data?.emailHref ?? null : null;
  const activeSocialLinks = content.socialLinks.filter((link) => link.active && link.href && link.platform).sort((a, b) => a.order - b.order);

  const hasAnyContent = phoneHref || whatsappHref || emailHref || content.address || content.hours || activeSocialLinks.length > 0;

  if (!hasAnyContent) {
    return <BuilderFallback reason="Henüz iletişim bilgisi eklenmedi." />;
  }

  const layoutClass = style.layout === "columns" ? "md:grid-cols-2" : "grid-cols-1";

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

        <div className={`grid gap-6 ${layoutClass}`}>
          <div className="flex flex-col gap-3">
            {phoneHref && data?.phoneLabel ? <a className="font-semibold hover:underline" href={phoneHref}>{data.phoneLabel}</a> : null}
            {whatsappHref ? <a className="font-semibold hover:underline" href={whatsappHref}>WhatsApp</a> : null}
            {emailHref && data?.emailLabel ? <a className="font-semibold hover:underline" href={emailHref}>{data.emailLabel}</a> : null}
          </div>
          <div className="flex flex-col gap-3 opacity-80" style={{ fontSize: "var(--ps-font-size-sm)" }}>
            {content.address ? <p>{content.address}</p> : null}
            {content.hours ? <p className="whitespace-pre-line">{content.hours}</p> : null}
          </div>
        </div>

        {activeSocialLinks.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {activeSocialLinks.map((link) => (
              <a key={link.id} href={link.href} className="rounded-full border border-[color-mix(in_srgb,var(--ps-secondary)_30%,transparent)] px-4 py-1.5 text-sm font-semibold transition hover:bg-[var(--ps-surface)]">
                {link.platform}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </BuilderContainer>
  );
}

export const contactInfoBlock: BlockDefinition<ContactInfoContent, ContactInfoStyle, ContactInfoData | undefined> = {
  key: asBlockKey("contact_info"),
  version: 1,
  label: "İletişim Bilgileri",
  description: "Telefon, WhatsApp, e-posta, adres ve çalışma saatleri.",
  family: "contact",
  variants: CONTACT_INFO_VARIANTS,
  defaultContent: defaultContactInfoContent,
  defaultStyle: defaultContactInfoStyle,
  validate: validateContactInfo,
  PreviewRenderer: ContactInfoView,
  PublicRenderer: ContactInfoView,
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
    icon: "phone",
    paletteGroup: "Diğer",
    draggable: true,
  },
};

registerBlock(contactInfoBlock);
