import "@/lib/builder/blocks/index";
import { registerTemplate } from "@/lib/builder/template-registry";
import { asBlockKey, asVariantKey, type BuilderTemplate } from "@/lib/builder/types";

// ============================================================
// Airport Shuttle — hızlı rezervasyon, pratik kullanım, mobilde hızlı okuma.
//
// Faz 14: Section sırası zenginleştirildi — Hero Slider -> Routes Showcase
// -> Trust Badges -> FAQ -> Contact Info. Kullanıcının Faz 14 talimatındaki
// Airport Shuttle blok listesinde ServicesGrid/CTA YOKTUR — bunların yerini
// Routes Showcase (güzergah odaklı) ve Contact Info (hızlı iletişim
// kanalları) alır, "hızlı teklif/pratik kullanım" hedefiyle daha tutarlı.
// Eski Hero'nun METNİ kaybedilmedi: Hero Slider'ın ilk slaytı önceki hero
// section'ıyla AYNI içeriği taşır. Yalnızca mevcut Hero Slider/Routes
// Showcase/Trust Badges/FAQ/Contact Info bloklarıyla kurulur — bu fazda
// yeni bir ayrı "Search/BookingForm" bloğu eklenmedi (kapsam dışı,
// ileriki bir faz).
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
          blockKey: asBlockKey("hero_slider"),
          variantKey: asVariantKey("fullwidth"),
          position: 0,
          active: true,
          content: {
            slides: [
              {
                id: "shuttle-slide-1",
                title: "Havalimanından adresinize hızlı ve güvenli transfer",
                subtitle: "Havalimanı Transfer",
                description: "Uçuşunuz iniş yaptığı anda yola çıkın, bekleme derdi olmadan hedefinize ulaşın.",
                desktopImageSrc: "",
                mobileImageSrc: "",
                primaryButtonText: "Hemen Teklif Al",
                primaryButtonHref: "/quote",
                secondaryButtonText: "İletişim",
                secondaryButtonHref: "/contact",
                align: "left",
                overlay: "none",
                active: true,
                order: 0,
              },
            ],
          },
          style: {
            autoplay: false,
            durationMs: 6000,
            pauseOnHover: true,
            transition: "fade",
            showIndicators: false,
            showArrows: false,
            loop: true,
          },
        },
        {
          blockKey: asBlockKey("routes_showcase"),
          variantKey: asVariantKey("grid"),
          position: 1,
          active: true,
          content: {
            eyebrow: "Popüler Rotalar",
            title: "En çok tercih edilen transfer güzergahları",
            description: "İhtiyacınıza göre havalimanı, otel veya şehir içi transfer seçeneklerinden birini tercih edin.",
            emptyStateTitle: "Rota yok",
            emptyStateDescription: "Bu işletme için henüz rota kaydı girilmedi.",
            maxItems: 3,
          },
          style: {
            columns: 3,
          },
        },
        {
          blockKey: asBlockKey("trust_badges"),
          variantKey: asVariantKey("grid"),
          position: 2,
          active: true,
          content: {
            eyebrow: "Güvenilirlik",
            title: "Neden bize güvenebilirsiniz?",
            items: [
              { id: "shuttle-badge-1", label: "Sigortalı Araçlar", logoSrc: "", href: "", altText: "Sigortalı Araçlar", active: true, order: 0 },
              { id: "shuttle-badge-2", label: "7/24 Destek", logoSrc: "", href: "", altText: "7/24 Destek", active: true, order: 1 },
              { id: "shuttle-badge-3", label: "Uçuş Takibi", logoSrc: "", href: "", altText: "Uçuş Takibi", active: true, order: 2 },
              { id: "shuttle-badge-4", label: "Sabit Fiyat", logoSrc: "", href: "", altText: "Sabit Fiyat", active: true, order: 3 },
            ],
          },
          style: {
            mode: "color",
          },
        },
        {
          blockKey: asBlockKey("faq"),
          variantKey: asVariantKey("accordion"),
          position: 3,
          active: true,
          content: {
            eyebrow: "Sıkça Sorulan Sorular",
            title: "Merak edilenler",
            description: "Havalimanı transferiyle ilgili en çok sorulan sorular.",
            items: [
              { id: "shuttle-faq-1", question: "Uçuşum gecikirse ek ücret öder miyim?", answer: "Hayır, uçuş takibi yaptığımız için gecikme durumunda ek ücret alınmaz.", active: true, order: 0 },
              { id: "shuttle-faq-2", question: "Şoför beni nerede karşılayacak?", answer: "Şoförünüz terminal çıkışında isminizle yazılı tabela ile sizi karşılar.", active: true, order: 1 },
              { id: "shuttle-faq-3", question: "Son dakika rezervasyon yapabilir miyim?", answer: "Uygunluk durumuna göre son dakika rezervasyonları da kabul edilir.", active: true, order: 2 },
            ],
          },
          style: {
            layout: "two-column",
          },
        },
        {
          blockKey: asBlockKey("contact_info"),
          variantKey: asVariantKey("card"),
          position: 4,
          active: true,
          content: {
            eyebrow: "İletişim",
            title: "Hemen bize ulaşın",
            address: "",
            hours: "Her gün 00:00 - 24:00",
            showPhone: true,
            showWhatsapp: true,
            showEmail: true,
            socialLinks: [],
          },
          style: {
            layout: "columns",
          },
        },
      ],
    },
  ],
};

registerTemplate(airportShuttleTemplate);
