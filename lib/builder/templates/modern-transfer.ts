import "@/lib/builder/blocks/index";
import { registerTemplate } from "@/lib/builder/template-registry";
import { asBlockKey, asVariantKey, type BuilderTemplate } from "@/lib/builder/types";

// ============================================================
// Modern Transfer — sade, güvenilir, kurumsal.
//
// Faz 14: Section sırası zenginleştirildi — Hero Slider -> ServicesGrid ->
// Vehicle Showcase -> Testimonials -> FAQ -> Booking CTA. Eski Hero/CTA'nın
// METNİ kaybedilmedi: Hero Slider'ın ilk slaytı ve Booking CTA, önceki
// hero/cta section'larıyla AYNI başlık/açıklama/buton metnini taşır —
// yalnızca daha zengin blok tiplerine taşındı. ServicesGrid AYNEN korundu.
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
          blockKey: asBlockKey("hero_slider"),
          variantKey: asVariantKey("fullwidth"),
          position: 0,
          active: true,
          content: {
            slides: [
              {
                id: "modern-slide-1",
                title: "Havalimanı ve otel transferinde güvenilir çözüm",
                subtitle: "Transfer & Turizm",
                description: "Profesyonel şoförler, konforlu araçlar, zamanında transfer hizmeti.",
                desktopImageSrc: "",
                mobileImageSrc: "",
                primaryButtonText: "Teklif Al",
                primaryButtonHref: "/quote",
                secondaryButtonText: "İletişim",
                secondaryButtonHref: "/contact",
                align: "left",
                overlay: "dark",
                active: true,
                order: 0,
              },
              {
                id: "modern-slide-2",
                title: "Geniş araç filomuzla her ihtiyaca uygun transfer",
                subtitle: "Araç Filomuz",
                description: "Sedan, minivan ve grup araçlarıyla konforlu bir yolculuk.",
                desktopImageSrc: "",
                mobileImageSrc: "",
                primaryButtonText: "Araçları Gör",
                primaryButtonHref: "/vehicles",
                secondaryButtonText: "",
                secondaryButtonHref: "/contact",
                align: "left",
                overlay: "dark",
                active: true,
                order: 1,
              },
            ],
          },
          style: {
            autoplay: true,
            durationMs: 6000,
            pauseOnHover: true,
            transition: "fade",
            showIndicators: true,
            showArrows: true,
            loop: true,
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
          blockKey: asBlockKey("vehicle_showcase"),
          variantKey: asVariantKey("grid"),
          position: 2,
          active: true,
          content: {
            eyebrow: "Araç Filomuz",
            title: "İhtiyacınıza uygun aracı seçin",
            description: "Konforlu ve bakımlı araçlarımızla güvenli bir yolculuk.",
            emptyStateTitle: "Araç yok",
            emptyStateDescription: "Bu işletme için henüz araç kaydı girilmedi.",
            maxItems: 6,
          },
          style: {
            columns: 3,
          },
        },
        {
          blockKey: asBlockKey("testimonials"),
          variantKey: asVariantKey("grid"),
          position: 3,
          active: true,
          content: {
            eyebrow: "Müşteri Yorumları",
            title: "Bize güvenenler ne diyor?",
            items: [
              { id: "modern-review-1", name: "Ahmet Y.", quote: "Zamanında geldiler, araç çok temizdi. Kesinlikle tavsiye ederim.", rating: 5, location: "İstanbul", avatarSrc: "", date: "", active: true, order: 0 },
              { id: "modern-review-2", name: "Elena K.", quote: "Very professional driver, smooth airport pickup.", rating: 5, location: "Antalya", avatarSrc: "", date: "", active: true, order: 1 },
              { id: "modern-review-3", name: "Mehmet A.", quote: "Fiyat performans olarak çok iyi bir hizmet.", rating: 4, location: "İzmir", avatarSrc: "", date: "", active: true, order: 2 },
            ],
          },
          style: {
            columns: 3,
          },
        },
        {
          blockKey: asBlockKey("faq"),
          variantKey: asVariantKey("accordion"),
          position: 4,
          active: true,
          content: {
            eyebrow: "Sıkça Sorulan Sorular",
            title: "Merak edilenler",
            description: "Transfer hizmetimizle ilgili en çok sorulan sorular.",
            items: [
              { id: "modern-faq-1", question: "Rezervasyonumu ne kadar önceden yapmalıyım?", answer: "Uçuş bilgilerinizle birlikte en az birkaç saat önceden rezervasyon oluşturmanızı öneririz.", active: true, order: 0 },
              { id: "modern-faq-2", question: "Uçuşum gecikirse ne olur?", answer: "Uçuş takibi yaparız, şoförünüz güncel iniş saatine göre sizi bekler.", active: true, order: 1 },
              { id: "modern-faq-3", question: "Ödemeyi nasıl yapabilirim?", answer: "Rezervasyon sırasında veya araç içinde farklı ödeme seçenekleriyle ödeme yapabilirsiniz.", active: true, order: 2 },
            ],
          },
          style: {
            layout: "single",
          },
        },
        {
          blockKey: asBlockKey("booking_cta"),
          variantKey: asVariantKey("centered"),
          position: 5,
          active: true,
          content: {
            title: "Rezervasyonunuzu şimdi oluşturun",
            description: "Uçuş bilgilerinizi paylaşın, size en uygun transfer seçeneğini sunalım.",
            primaryButtonText: "Teklif Al",
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

registerTemplate(modernTransferTemplate);
