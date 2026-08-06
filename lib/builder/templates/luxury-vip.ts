import "@/lib/builder/blocks/index";
import { registerTemplate } from "@/lib/builder/template-registry";
import { asBlockKey, asVariantKey, type BuilderTemplate } from "@/lib/builder/types";

// ============================================================
// Luxury VIP — premium, prestijli, koyu tonlu.
//
// Faz 14: Section sırası zenginleştirildi — Hero Slider -> Statistics ->
// Vehicle Showcase -> Testimonials -> Partners -> Booking CTA. Eski
// ServicesGrid'in yerini (kullanıcının Faz 14 talimatındaki Luxury VIP
// blok listesinde ServicesGrid YOKTUR) Vehicle Showcase alır — VIP transfer
// için "hizmetler" yerine "filo" vurgusu daha uygun. Eski Hero/CTA'nın
// METNİ kaybedilmedi: Hero Slider'ın ilk slaytı ve Booking CTA, önceki
// hero/cta section'larıyla AYNI içeriği taşır. Tema yalnızca
// themeKey: "luxury" üzerinden referans edilir — hiçbir hardcoded renk
// değeri bu dosyada YOKTUR.
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
          blockKey: asBlockKey("hero_slider"),
          variantKey: asVariantKey("fullwidth"),
          position: 0,
          active: true,
          content: {
            slides: [
              {
                id: "luxury-slide-1",
                title: "Ayrıcalıklı transferde yeni standart",
                subtitle: "VIP Transfer Deneyimi",
                description: "Özel şoförler, prestijli araçlar, kusursuz bir VIP transfer deneyimi.",
                desktopImageSrc: "",
                mobileImageSrc: "",
                primaryButtonText: "VIP Rezervasyon",
                primaryButtonHref: "/quote",
                secondaryButtonText: "İletişim",
                secondaryButtonHref: "/contact",
                align: "center",
                overlay: "dark",
                active: true,
                order: 0,
              },
              {
                id: "luxury-slide-2",
                title: "Her detayda mükemmellik",
                subtitle: "Prestijli Filo",
                description: "Özenle seçilmiş premium araçlarla konfor ve gizlilik bir arada.",
                desktopImageSrc: "",
                mobileImageSrc: "",
                primaryButtonText: "Filoyu İncele",
                primaryButtonHref: "/vehicles",
                secondaryButtonText: "",
                secondaryButtonHref: "/contact",
                align: "center",
                overlay: "dark",
                active: true,
                order: 1,
              },
            ],
          },
          style: {
            autoplay: true,
            durationMs: 7000,
            pauseOnHover: true,
            transition: "fade",
            showIndicators: true,
            showArrows: true,
            loop: true,
          },
        },
        {
          blockKey: asBlockKey("statistics"),
          variantKey: asVariantKey("row"),
          position: 1,
          active: true,
          content: {
            eyebrow: "Rakamlarla Biz",
            title: "Güvenle tercih ediliyoruz",
            animateOnScroll: false,
            items: [
              { id: "luxury-stat-1", value: 12000, suffix: "+", label: "VIP transfer", order: 0, active: true },
              { id: "luxury-stat-2", value: 3200, suffix: "+", label: "Memnun müşteri", order: 1, active: true },
              { id: "luxury-stat-3", value: 15, suffix: "+", label: "Premium araç", order: 2, active: true },
              { id: "luxury-stat-4", value: 10, suffix: "", label: "Yıllık deneyim", order: 3, active: true },
            ],
          },
          style: {
            columns: 4,
            tone: "surface",
          },
        },
        {
          blockKey: asBlockKey("vehicle_showcase"),
          variantKey: asVariantKey("grid"),
          position: 2,
          active: true,
          content: {
            eyebrow: "Hizmetlerimiz",
            title: "Prestijli transfer seçenekleri",
            description: "Her detayın özenle planlandığı, konfor ve gizliliğin ön planda olduğu transfer hizmetleri.",
            emptyStateTitle: "Araç yok",
            emptyStateDescription: "Bu işletme için henüz araç kaydı girilmedi.",
            maxItems: 6,
          },
          style: {
            columns: 2,
          },
        },
        {
          blockKey: asBlockKey("testimonials"),
          variantKey: asVariantKey("carousel"),
          position: 3,
          active: true,
          content: {
            eyebrow: "Müşteri Yorumları",
            title: "VIP misafirlerimiz ne diyor?",
            items: [
              { id: "luxury-review-1", name: "Sultan K.", quote: "Tam bir VIP deneyim, her ayrıntı düşünülmüştü.", rating: 5, location: "İstanbul", avatarSrc: "", date: "", active: true, order: 0 },
              { id: "luxury-review-2", name: "James R.", quote: "Impeccable service, the chauffeur was extremely professional.", rating: 5, location: "Bodrum", avatarSrc: "", date: "", active: true, order: 1 },
            ],
          },
          style: {
            columns: 2,
          },
        },
        {
          blockKey: asBlockKey("partners"),
          variantKey: asVariantKey("grid"),
          position: 4,
          active: true,
          content: {
            eyebrow: "İş Ortaklarımız",
            title: "Birlikte çalıştığımız prestijli markalar",
            items: [
              { id: "luxury-partner-1", label: "Otel Grubu A", logoSrc: "", href: "", altText: "Otel Grubu A", active: true, order: 0 },
              { id: "luxury-partner-2", label: "Özel Etkinlik Ajansı", logoSrc: "", href: "", altText: "Özel Etkinlik Ajansı", active: true, order: 1 },
              { id: "luxury-partner-3", label: "VIP Concierge", logoSrc: "", href: "", altText: "VIP Concierge", active: true, order: 2 },
            ],
          },
          style: {
            mode: "monochrome",
          },
        },
        {
          blockKey: asBlockKey("booking_cta"),
          variantKey: asVariantKey("centered"),
          position: 5,
          active: true,
          content: {
            title: "Özel transfer talebinizi iletin",
            description: "VIP rezervasyon talepleriniz için ekibimiz size özel olarak dönüş yapar.",
            primaryButtonText: "VIP Rezervasyon Yap",
            primaryButtonHref: "/quote",
            showWhatsapp: true,
            whatsappButtonText: "WhatsApp'tan yaz",
            showPhone: true,
            phoneButtonText: "Hemen ara",
          },
          style: {
            tone: "brand",
          },
        },
      ],
    },
  ],
};

registerTemplate(luxuryVipTemplate);
