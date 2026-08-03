import type { ServicesGridData, ServicesGridItem } from "@/lib/builder/blocks/index";
import type { BlockKey, JsonRecord } from "@/lib/builder/types";

// ============================================================
// Preview-only veri adaptörü (Faz 5).
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
//   - Block renderer'lar (hero.tsx/cta.tsx/services-grid.tsx) bu dosyanın
//     varlığından habersizdir; yalnızca `data` prop'unu alırlar.
//   - İleride gerçek bir veri adaptörü (business_services satırlarını
//     ServicesGridItem[]'a eşleyen) bu dosyanın YERİNE geçecek, block
//     tanımlarında hiçbir değişiklik gerekmeyecek.
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

// Section Preview'ın (nötr bir katman, bir "blok" DEĞİL) hangi block_key için
// hangi preview verisini üreteceğini bildiği TEK yer. Hero/CTA gibi kendi
// kendine yeten bloklar için `undefined` döner — bu, block tanımlarındaki
// `TData = undefined` varsayılanıyla birebir uyumludur.
export function resolvePreviewData(blockKey: BlockKey, content: JsonRecord): unknown {
  if (blockKey === "services_grid") {
    const maxItems = typeof content.maxItems === "number" ? content.maxItems : SAMPLE_SERVICES.length;
    return buildServicesGridPreviewData(maxItems);
  }

  return undefined;
}
