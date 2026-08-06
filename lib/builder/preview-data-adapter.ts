import type { ServicesGridData, ServicesGridItem } from "@/lib/builder/blocks/index";
import type { GalleryData } from "@/lib/builder/blocks/gallery";
import type { VehicleShowcaseData } from "@/lib/builder/blocks/vehicle-showcase";
import type { RouteShowcaseData } from "@/lib/builder/blocks/routes-showcase";
import type { BookingCtaData } from "@/lib/builder/blocks/booking-cta";
import type { ContactInfoData } from "@/lib/builder/blocks/contact-info";
import type { BlockKey, JsonRecord } from "@/lib/builder/types";

// ============================================================
// Preview-only veri adaptörü (Faz 5, Faz 14'te genişletildi).
//
// Template seed'leri (Faz 4) yalnızca BAŞLIK/AÇIKLAMA metinlerini taşır —
// ServicesGrid gibi mevcut içerik modelinden (business_services) beslenmesi
// gereken bloklar için gerçek satırlar henüz yok (bu Faz DB'ye bağlanmıyor).
// Bu dosya, Preview Renderer'ın o bloğu GERÇEKÇİ örnek verilerle
// gösterebilmesi için küçük, izole bir uyarlama katmanıdır.
//
// Kurallar:
//   - Yalnızca preview katmanında (components/builder/*) kullanılır.
//   - lib/business-panel.ts'teki gerçek tiplere (BusinessServiceRecord vb.)
//     HİÇ bağlanmaz — kendi minimal örnek verisini üretir.
//   - Block renderer'lar bu dosyanın varlığından habersizdir; yalnızca
//     `data` prop'unu alırlar.
//   - Faz 14: Vehicle/Route Showcase örnek verisi, gerçek şemada OLMAYAN
//     kapasite/bagaj/fiyat/süre alanlarını da (yalnızca burada, admin
//     önizlemesinde) gösterir — işletme sahibine "bu bilgi bir gün
//     eklenirse nasıl görüneceğini" göstermek içindir, gerçek ziyaretçiye
//     ASLA sızmaz (public-data-adapter.ts bu alanları hiç doldurmaz).
//   - Bilerek `server-only` İÇERMEZ: bu dosya "use client" olan
//     live-preview.tsx tarafından (dolaylı olarak) client bundle'a
//     dahil edilir.
// ============================================================

const SAMPLE_SERVICES: ServicesGridItem[] = [
  { id: "sample-1", title: "Havalimanı Transferi", description: "Havalimanından otelinize konforlu ve zamanında ulaşım.", href: "#" },
  { id: "sample-2", title: "Otel Transferi", description: "Oteller arası veya şehir içi transfer hizmeti.", href: "#" },
  { id: "sample-3", title: "VIP Transfer", description: "Özel şoför ve premium araçlarla ayrıcalıklı transfer.", href: "#" },
  { id: "sample-4", title: "Grup Transferi", description: "Kalabalık gruplar için geniş araç seçenekleri.", href: "#" },
  { id: "sample-5", title: "Şehir Turu", description: "Rehberli veya rehbersiz şehir içi tur transferleri.", href: "#" },
  { id: "sample-6", title: "Uzun Mesafe Transfer", description: "Şehirler arası konforlu uzun mesafe transfer hizmeti.", href: "#" },
];

export function buildServicesGridPreviewData(maxItems: number): ServicesGridData {
  const safeMax = Number.isFinite(maxItems) ? Math.max(0, Math.min(maxItems, SAMPLE_SERVICES.length)) : SAMPLE_SERVICES.length;
  return { items: SAMPLE_SERVICES.slice(0, safeMax) };
}

function buildGalleryPreviewData(): GalleryData {
  return {
    items: Array.from({ length: 6 }, (_, index) => ({
      id: `sample-media-${index}`,
      imageSrc: "",
      altText: `Örnek görsel ${index + 1}`,
      caption: "",
    })),
  };
}

function buildVehicleShowcasePreviewData(maxItems: number): VehicleShowcaseData {
  const sample = [
    { id: "sample-vehicle-1", title: "Mercedes Vito", description: "Konforlu, geniş iç hacimli VIP minivan.", href: "#", capacity: "6 kişi", luggage: "6 büyük valiz" },
    { id: "sample-vehicle-2", title: "Mercedes E-Class", description: "Prestijli sedan, iş seyahatleri için ideal.", href: "#", capacity: "3 kişi", luggage: "2 büyük valiz" },
    { id: "sample-vehicle-3", title: "Mercedes Sprinter", description: "Kalabalık gruplar için geniş transfer aracı.", href: "#", capacity: "16 kişi", luggage: "16 büyük valiz" },
  ];
  return { items: sample.slice(0, Math.max(0, Math.min(maxItems, sample.length))) };
}

function buildRoutesShowcasePreviewData(maxItems: number): RouteShowcaseData {
  const sample = [
    { id: "sample-route-1", title: "Havalimanı → Şehir Merkezi", description: "En sık tercih edilen güzergah.", href: "#", priceLabel: "1500 ₺'den başlayan fiyatlarla", durationLabel: "~35 dk" },
    { id: "sample-route-2", title: "Havalimanı → Otel Bölgesi", description: "Tatil bölgelerine direkt transfer.", href: "#", priceLabel: "2000 ₺'den başlayan fiyatlarla", durationLabel: "~50 dk" },
  ];
  return { items: sample.slice(0, Math.max(0, Math.min(maxItems, sample.length))) };
}

function buildBookingCtaPreviewData(): BookingCtaData {
  return { whatsappHref: "https://wa.me/905000000000", phoneHref: "tel:+905000000000" };
}

function buildContactInfoPreviewData(): ContactInfoData {
  return {
    phoneHref: "tel:+905000000000",
    phoneLabel: "+90 500 000 00 00",
    whatsappHref: "https://wa.me/905000000000",
    emailHref: "mailto:info@example.com",
    emailLabel: "info@example.com",
  };
}

// Section Preview'ın (nötr bir katman, bir "blok" DEĞİL) hangi block_key için
// hangi preview verisini üreteceğini bildiği TEK yer. Hero/CTA gibi kendi
// kendine yeten bloklar için `undefined` döner — bu, block tanımlarındaki
// `TData = undefined` varsayılanıyla birebir uyumludur.
export function resolvePreviewData(blockKey: BlockKey, content: JsonRecord): unknown {
  const key = String(blockKey);

  if (key === "services_grid") {
    const maxItems = typeof content.maxItems === "number" ? content.maxItems : SAMPLE_SERVICES.length;
    return buildServicesGridPreviewData(maxItems);
  }

  if (key === "gallery") {
    return buildGalleryPreviewData();
  }

  if (key === "vehicle_showcase") {
    const maxItems = typeof content.maxItems === "number" ? content.maxItems : 6;
    return buildVehicleShowcasePreviewData(maxItems);
  }

  if (key === "routes_showcase") {
    const maxItems = typeof content.maxItems === "number" ? content.maxItems : 6;
    return buildRoutesShowcasePreviewData(maxItems);
  }

  if (key === "booking_cta") {
    return buildBookingCtaPreviewData();
  }

  if (key === "contact_info") {
    return buildContactInfoPreviewData();
  }

  return undefined;
}
