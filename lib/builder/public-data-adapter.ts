import "server-only";

import type { BusinessPanelData } from "@/lib/business-panel";
import { resolveBusinessMediaSourceUrl } from "@/lib/media";
import type { ServicesGridData, ServicesGridItem } from "@/lib/builder/blocks/services-grid";
import type { BlockKey, JsonRecord } from "@/lib/builder/types";

// ============================================================
// Faz 11/12 — public render icin GERCEK veri adaptoru.
//
// lib/builder/preview-data-adapter.ts (Faz 5) bilerek SAMPLE_SERVICES gibi
// sabit ornek veri kullanir ve admin/preview disinda ASLA kullanilmamalidir.
// Bu dosya onun public-site karsiligi: ayni blok "data" sozlesmesini
// (ör. ServicesGridData) doldurur ama kaynagi HER ZAMAN o business'in
// GERCEK, zaten yayinlanmis panel verisidir (BusinessPanelData) — mevcut
// business_services/vehicles/routes/blog CRUD'una hicbir sekilde dokunmaz,
// yalnizca onu builder blogunun bekledigi minimal gorunum modeline esler.
//
// Faz 12: "services_grid" blogu her sistem sayfasinda (home/services/
// vehicles/routes/blog) AYNI blockKey ile ama FARKLI bir gercek koleksiyona
// baglanmak icin kullanilir (bkz. workspace-state.ts PAGE_BLUEPRINTS — hepsi
// ayni "services_grid" blogunu kullanir, yalnizca kopya metni farklidir).
// blockKey tek basina hangi koleksiyonun gosterilecegini ayirt edemez, bu
// yuzden caller (public-page-renderer.tsx) hangi SAYFADA oldugunu
// (pageKey) context olarak gecer.
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
  if (String(blockKey) === "services_grid") {
    const collection = COLLECTION_BY_PAGE_KEY[context.pageKey] ?? "services";
    return buildGridPublicData(collection, content, panel);
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
