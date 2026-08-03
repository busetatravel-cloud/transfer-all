import "@/lib/builder/blocks/index";
import { registerTemplate } from "@/lib/builder/template-registry";
import { asBlockKey, asVariantKey, type BuilderTemplate } from "@/lib/builder/types";

// ============================================================
// Luxury VIP — premium, prestijli, koyu tonlu.
// Section sırası (bilinçli olarak farklı): Hero -> CTA -> ServicesGrid.
// Tema yalnızca themeKey: "luxury" üzerinden referans edilir — hiçbir
// hardcoded if/else veya renk değeri bu dosyada YOKTUR; koyu zemin/altın
// vurgu Theme Registry'deki "luxury" kaydından (lib/theme-registry.ts)
// otomatik gelir.
// ============================================================
export const luxuryVipTemplate: BuilderTemplate = {
  key: "luxury-vip",
  label: "Luxury VIP",
  description:
    "Prestijli, koyu tonlu ve altın vurgulu premium VIP transfer deneyimi şablonu.",
  category: "premium",
  themeKey: "luxury",
  preview: {
    thumbnailKey: "template-luxury-vip",
    desktopPreviewWidth: 1280,
    tabletPreviewWidth: 768,
    mobilePreviewWidth: 375,
    tagline: "Premium ve prestijli VIP transfer deneyimi.",
    featureBadges: ["Koyu Tema", "Altın Vurgular", "Premium Tipografi"],
    recommendedIndustry: "VIP transfer, lüks araç kiralama ve premium turizm hizmetleri",
    recommendedColorMode: "dark",
  },
  supportedLocales: ["tr", "en"],
  seoIntent: {
    metaTitleHint: "{business} | VIP ve Lüks Transfer Hizmeti",
    metaDescriptionHint:
      "Prestijli araçlar ve özel şoförlerle VIP transfer deneyimi. Hemen rezervasyon yapın.",
    primaryKeywords: ["VIP transfer", "lüks transfer", "özel şoför"],
  },
  targetCustomerProfile: "Premium/lüks segmentte hizmet veren VIP transfer ve özel şoförlük firmaları.",
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
            eyebrow: "VIP Transfer Deneyimi",
            title: "Ayrıcalıklı transferde yeni standart",
            subtitle: "Özel şoförler, prestijli araçlar, kusursuz bir VIP transfer deneyimi.",
            primaryButtonText: "VIP Rezervasyon",
            primaryButtonHref: "/quote",
            secondaryButtonText: "İletişim",
            secondaryButtonHref: "/contact",
          },
          style: {
            align: "center",
            overlay: "dark",
          },
        },
        {
          blockKey: asBlockKey("cta"),
          variantKey: asVariantKey("centered"),
          position: 1,
          active: true,
          content: {
            title: "Özel transfer talebinizi iletin",
            description: "VIP rezervasyon talepleriniz için ekibimiz size özel olarak dönüş yapar.",
            primaryButtonText: "VIP Rezervasyon Yap",
            primaryButtonHref: "/quote",
          },
          style: {
            tone: "brand",
          },
        },
        {
          blockKey: asBlockKey("services_grid"),
          variantKey: asVariantKey("grid"),
          position: 2,
          active: true,
          content: {
            eyebrow: "Hizmetlerimiz",
            title: "Prestijli transfer seçenekleri",
            description:
              "Her detayın özenle planlandığı, konfor ve gizliliğin ön planda olduğu transfer hizmetleri.",
            emptyStateTitle: "Hizmet yok",
            emptyStateDescription: "Bu işletme için henüz hizmet kaydı girilmedi.",
            maxItems: 6,
          },
          style: {
            columns: 2,
          },
        },
      ],
    },
  ],
};

registerTemplate(luxuryVipTemplate);
