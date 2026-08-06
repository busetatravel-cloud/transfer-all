import "server-only";

import type { BusinessPanelData } from "@/lib/business-panel";
import { getSafeMediaSourceUrl, resolveBusinessMediaSourceUrl } from "@/lib/media";
import type { ServicesGridData, ServicesGridItem } from "@/lib/builder/blocks/services-grid";
import type { GalleryData, GalleryItem } from "@/lib/builder/blocks/gallery";
import type { VehicleShowcaseData } from "@/lib/builder/blocks/vehicle-showcase";
import type { RouteShowcaseData } from "@/lib/builder/blocks/routes-showcase";
import type { BookingCtaData } from "@/lib/builder/blocks/booking-cta";
import type { ContactInfoData } from "@/lib/builder/blocks/contact-info";
import type { BlockKey, JsonRecord } from "@/lib/builder/types";

// ============================================================
// Faz 11/12/14 — public render icin GERCEK veri adaptoru.
//
// lib/builder/preview-data-adapter.ts (Faz 5) bilerek SAMPLE_SERVICES gibi
// sabit ornek veri kullanir ve admin/preview disinda ASLA kullanilmamalidir.
// Bu dosya onun public-site karsiligi: ayni blok "data" sozlesmesini
// (ör. ServicesGridData) doldurur ama kaynagi HER ZAMAN o business'in
// GERCEK, zaten yayinlanmis panel verisidir (BusinessPanelData) — mevcut
// business_services/vehicles/routes/blog CRUD'una hicbir sekilde dokunmaz,
// yalnizca onu builder blogunun bekledigi minimal gorunum modeline esler.
//
// Faz 14: Gallery/VehicleShowcase/RoutesShowcase/BookingCta/ContactInfo icin
// yeni dallar eklendi. Hero Slider/FAQ/Testimonials/Statistics/Video/
// TrustBadges/Partners icin BILEREK hicbir dal YOK — bu bloklar tamamen
// builder content'iyle beslenir (gercek bir yorum/istatistik/SSS tablosu
// yok), `resolvePublicBlockData` onlar icin `undefined` doner ve block
// tanimlarindaki `TData = undefined` varsayilanıyla uyumlu kalir.
// ============================================================

export type PublicBlockDataContext = {
  pageKey: string;
};

const COLLECTION_BY_PAGE_KEY: Record<string, "services" | "vehicles" | "routes" | "blogs"> = {
  home: "services",
  services: "services",
  vehicles: "vehicles",
  routes: "routes",
  blog: "blogs",
};

export function resolvePublicBlockData(
  blockKey: BlockKey,
  content: JsonRecord,
  panel: BusinessPanelData,
  context: PublicBlockDataContext,
): unknown {
  const key = String(blockKey);

  if (key === "services_grid") {
    const collection = COLLECTION_BY_PAGE_KEY[context.pageKey] ?? "services";
    return buildGridPublicData(collection, content, panel);
  }

  if (key === "gallery") {
    return buildGalleryPublicData(panel);
  }

  if (key === "vehicle_showcase") {
    return buildVehicleShowcasePublicData(content, panel);
  }

  if (key === "routes_showcase") {
    return buildRoutesShowcasePublicData(content, panel);
  }

  if (key === "booking_cta") {
    return buildBookingCtaPublicData(panel);
  }

  if (key === "contact_info") {
    return buildContactInfoPublicData(panel);
  }

  return undefined;
}

function buildGridPublicData(
  collection: "services" | "vehicles" | "routes" | "blogs",
  content: JsonRecord,
  panel: BusinessPanelData,
): ServicesGridData {
  const maxItems = typeof content.maxItems === "number" && Number.isFinite(content.maxItems) ? content.maxItems : 6;

  if (collection === "blogs") {
    const imageSrc = resolveBusinessMediaSourceUrl(panel.mediaAssets, "blog_cover");
    const items: ServicesGridItem[] = panel.blogs
      .filter((post) => post.published)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, Math.max(0, maxItems))
      .map((post) => ({
        id: post.id,
        title: post.title,
        description: post.excerpt || post.content || "",
        href: `/blog/${post.slug || post.id}`,
        imageSrc,
      }));
    return { items };
  }

  const mediaSlot = collection === "vehicles" ? "vehicle_cover" : collection === "routes" ? "route_cover" : "service_cover";
  const basePath = collection === "vehicles" ? "/vehicles" : collection === "routes" ? "/routes" : "/services";
  const records = collection === "vehicles" ? panel.vehicles : collection === "routes" ? panel.routes : panel.services;
  const imageSrc = resolveBusinessMediaSourceUrl(panel.mediaAssets, mediaSlot);

  const items: ServicesGridItem[] = records
    .filter((record) => record.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, Math.max(0, maxItems))
    .map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description,
      href: `${basePath}/${record.slug || record.id}`,
      imageSrc,
    }));

  return { items };
}

// Gallery: mevcut yuklu TUM medya varliklarini (slot/kind ayrimi yapmadan,
// yalnizca gercekten yuklenmis "ready" durumdakileri) gosterir — yeni bir
// medya sistemi kurulmaz, zaten var olan panel.mediaAssets kullanilir.
function buildGalleryPublicData(panel: BusinessPanelData): GalleryData {
  const items: GalleryItem[] = panel.mediaAssets
    .filter((asset) => asset.status === "ready")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map((asset) => ({
      id: asset.id,
      imageSrc: getSafeMediaSourceUrl(asset),
      altText: asset.metadata?.altText?.trim() || asset.altText?.trim() || "",
      caption: "",
    }));

  return { items };
}

// Vehicle/Routes Showcase: ServicesGrid ile ayni koleksiyon mantigi, ama
// kapasite/bagaj/fiyat/sure gibi mevcut semada OLMAYAN alanlar bilerek
// undefined birakilir (bkz. vehicle-showcase.tsx / routes-showcase.tsx
// basindaki "ONEMLI KISIT" notu) — sahte veri public render'a sizmaz.
function buildVehicleShowcasePublicData(content: JsonRecord, panel: BusinessPanelData): VehicleShowcaseData {
  const maxItems = typeof content.maxItems === "number" && Number.isFinite(content.maxItems) ? content.maxItems : 6;
  const imageSrc = resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_cover");

  const items = panel.vehicles
    .filter((vehicle) => vehicle.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, Math.max(0, maxItems))
    .map((vehicle) => ({
      id: vehicle.id,
      title: vehicle.title,
      description: vehicle.description,
      href: `/vehicles/${vehicle.slug || vehicle.id}`,
      imageSrc,
    }));

  return { items };
}

function buildRoutesShowcasePublicData(content: JsonRecord, panel: BusinessPanelData): RouteShowcaseData {
  const maxItems = typeof content.maxItems === "number" && Number.isFinite(content.maxItems) ? content.maxItems : 6;
  const imageSrc = resolveBusinessMediaSourceUrl(panel.mediaAssets, "route_cover");

  const items = panel.routes
    .filter((route) => route.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, Math.max(0, maxItems))
    .map((route) => ({
      id: route.id,
      title: route.title,
      description: route.description,
      href: `/routes/${route.slug || route.id}`,
      imageSrc,
    }));

  return { items };
}

// WhatsApp deep link'i yalnizca rakam kabul eder ("+"/bosluk/tire kaldirilir)
// — bkz. https://faq.whatsapp.com/general/chats/how-to-use-click-to-chat.
function toWhatsAppDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

function buildBookingCtaPublicData(panel: BusinessPanelData): BookingCtaData {
  const phone = panel.business?.phone?.trim() || "";
  const whatsapp = panel.business?.whatsapp?.trim() || "";
  const whatsappDigits = toWhatsAppDigits(whatsapp);

  return {
    phoneHref: phone ? `tel:${phone}` : null,
    whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
  };
}

function buildContactInfoPublicData(panel: BusinessPanelData): ContactInfoData {
  const phone = panel.business?.phone?.trim() || "";
  const whatsapp = panel.business?.whatsapp?.trim() || "";
  const email = panel.business?.email?.trim() || "";
  const whatsappDigits = toWhatsAppDigits(whatsapp);

  return {
    phoneHref: phone ? `tel:${phone}` : null,
    phoneLabel: phone || null,
    whatsappHref: whatsappDigits ? `https://wa.me/${whatsappDigits}` : null,
    emailHref: email ? `mailto:${email}` : null,
    emailLabel: email || null,
  };
}
