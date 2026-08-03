import "@/lib/builder/blocks/index";
import { registerTemplate } from "@/lib/builder/template-registry";
import { asBlockKey, asVariantKey, type BuilderTemplate } from "@/lib/builder/types";

// ============================================================
// Airport Shuttle — hızlı rezervasyon, pratik kullanım, mobilde hızlı okuma.
// Section sırası: Hero -> ServicesGrid -> CTA.
// Yalnızca mevcut Hero/ServicesGrid/CTA bloklarıyla kurulur — bu fazda yeni
// bir Search/BookingForm bloğu eklenmedi (kapsam dışı, ileriki bir faz).
// ============================================================
export const airportShuttleTemplate: BuilderTemplate = {
  key: "airport-shuttle",
  label: "Airport Shuttle",
  description: "Havalimanı transferine odaklı, hızlı teklif ve pratik kullanım şablonu.",
  category: "shuttle",
  themeKey: "modern",
  preview: {
    thumbnailKey: "template-airport-shuttle",
    desktopPreviewWidth: 1280,
    tabletPreviewWidth: 768,
    mobilePreviewWidth: 375,
    tagline: "Hızlı, pratik havalimanı transfer çözümü.",
    featureBadges: ["Hızlı Teklif", "Mobil Uyumlu", "Kolay Rezervasyon"],
    recommendedIndustry: "Havalimanı transfer ve shuttle hizmeti veren işletmeler",
    recommendedColorMode: "light",
  },
  supportedLocales: ["tr", "en"],
  seoIntent: {
    metaTitleHint: "{business} | Havalimanı Shuttle ve Transfer Hizmeti",
    metaDescriptionHint: "Havalimanından otele veya şehir merkezine hızlı transfer. Hemen teklif alın.",
    primaryKeywords: ["havalimanı shuttle", "havalimanı transfer", "hızlı transfer"],
  },
  targetCustomerProfile:
    "Havalimanı transferi ve shuttle hizmetine odaklanan, hızlı rezervasyon önceliği olan işletmeler.",
  pages: [
    {
      pageKey: "home",
      title: "Anasayfa",
      isSystemPage: true,
      sections: [
        {
          blockKey: asBlockKey("hero"),
          variantKey: asVariantKey("centered"),
          position: 0,
          active: true,
          content: {
            eyebrow: "Havalimanı Transfer",
            title: "Havalimanından adresinize hızlı ve güvenli transfer",
            subtitle: "Uçuşunuz iniş yaptığı anda yola çıkın, bekleme derdi olmadan hedefinize ulaşın.",
            primaryButtonText: "Hemen Teklif Al",
            primaryButtonHref: "/quote",
            secondaryButtonText: "İletişim",
            secondaryButtonHref: "/contact",
          },
          style: {
            align: "left",
            overlay: "none",
          },
        },
        {
          blockKey: asBlockKey("services_grid"),
          variantKey: asVariantKey("grid"),
          position: 1,
          active: true,
          content: {
            eyebrow: "Transfer Seçenekleri",
            title: "Havalimanı, otel ve şehir içi transfer",
            description: "İhtiyacınıza göre havalimanı, otel veya şehir içi transfer seçeneklerinden birini tercih edin.",
            emptyStateTitle: "Hizmet yok",
            emptyStateDescription: "Bu işletme için henüz hizmet kaydı girilmedi.",
            maxItems: 3,
          },
          style: {
            columns: 3,
          },
        },
        {
          blockKey: asBlockKey("cta"),
          variantKey: asVariantKey("centered"),
          position: 2,
          active: true,
          content: {
            title: "Transferini Planla",
            description: "Uçuş bilgilerinizi paylaşın, size en uygun transfer seçeneğini birkaç dakika içinde sunalım.",
            primaryButtonText: "Teklif Al",
            primaryButtonHref: "/quote",
          },
          style: {
            tone: "surface",
          },
        },
      ],
    },
  ],
};

registerTemplate(airportShuttleTemplate);
