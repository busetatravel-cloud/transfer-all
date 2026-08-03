import "@/lib/builder/blocks/index";
import { registerTemplate } from "@/lib/builder/template-registry";
import { asBlockKey, asVariantKey, type BuilderTemplate } from "@/lib/builder/types";

// ============================================================
// Modern Transfer — sade, güvenilir, kurumsal.
// Section sırası: Hero -> ServicesGrid -> CTA.
// ============================================================
export const modernTransferTemplate: BuilderTemplate = {
  key: "modern-transfer",
  label: "Modern Transfer",
  description:
    "Mevcut sistemin sade, güvenilir ve kurumsal görünümünü temsil eden varsayılan şablon.",
  category: "general",
  themeKey: "modern",
  preview: {
    thumbnailKey: "template-modern-transfer",
    desktopPreviewWidth: 1280,
    tabletPreviewWidth: 768,
    mobilePreviewWidth: 375,
    tagline: "Sade, güvenilir, kurumsal.",
    featureBadges: ["Kurumsal Görünüm", "Hızlı Kurulum", "Tüm Cihazlarda Uyumlu"],
    recommendedIndustry: "Genel transfer ve turizm işletmeleri",
    recommendedColorMode: "light",
  },
  supportedLocales: ["tr", "en"],
  seoIntent: {
    metaTitleHint: "{business} | Havalimanı ve Otel Transfer Hizmeti",
    metaDescriptionHint:
      "Güvenilir, konforlu ve zamanında transfer hizmeti. Hemen teklif alın.",
    primaryKeywords: ["havalimanı transfer", "otel transfer", "transfer hizmeti"],
  },
  targetCustomerProfile: "Kurumsal görünüm isteyen, orta ölçekli transfer ve turizm firmaları.",
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
            eyebrow: "Transfer & Turizm",
            title: "Havalimanı ve otel transferinde güvenilir çözüm",
            subtitle: "Profesyonel şoförler, konforlu araçlar, zamanında transfer hizmeti.",
            primaryButtonText: "Teklif Al",
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
            eyebrow: "Hizmetlerimiz",
            title: "İhtiyacınıza uygun transfer seçenekleri",
            description: "Havalimanı, otel ve şehir içi transferlerde konforlu ve güvenli hizmet.",
            emptyStateTitle: "Hizmet yok",
            emptyStateDescription: "Bu işletme için henüz hizmet kaydı girilmedi.",
            maxItems: 6,
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
            title: "Rezervasyonunuzu şimdi oluşturun",
            description: "Uçuş bilgilerinizi paylaşın, size en uygun transfer seçeneğini sunalım.",
            primaryButtonText: "Teklif Al",
            primaryButtonHref: "/quote",
          },
          style: {
            tone: "brand",
          },
        },
      ],
    },
  ],
};

registerTemplate(modernTransferTemplate);
