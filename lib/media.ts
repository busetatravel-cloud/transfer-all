import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessMediaAssetRecord = {
  id: string;
  businessId: string;
  kind: string;
  sourceUrl: string;
  storagePath: string;
  altText: string;
  status: "placeholder" | "ready" | "failed";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMediaAssetInput = {
  kind: string;
  sourceUrl?: string;
  storagePath?: string;
  altText?: string;
  status?: BusinessMediaAssetRecord["status"];
  sortOrder?: number;
};

export const MEDIA_PLACEHOLDER_SRC =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='800' fill='%23e2e8f0'/%3E%3Cpath d='M200 560l180-180 150 150 120-120 250 250H200z' fill='%2394a3b8'/%3E%3Ccircle cx='430' cy='300' r='70' fill='%23cbd5e1'/%3E%3C/svg%3E";

const demoMedia = new Map<string, BusinessMediaAssetRecord[]>();

function nowIso() {
  return new Date().toISOString();
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function mapMediaAsset(row: Record<string, unknown>): BusinessMediaAssetRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    kind: String(row.kind ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    storagePath: String(row.storage_path ?? ""),
    altText: String(row.alt_text ?? ""),
    status: (row.status as BusinessMediaAssetRecord["status"]) ?? "placeholder",
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export function getSafeMediaSourceUrl(asset?: Pick<BusinessMediaAssetRecord, "sourceUrl"> | null) {
  return asset?.sourceUrl?.trim() || MEDIA_PLACEHOLDER_SRC;
}

export function buildMediaPlaceholderAsset(
  businessId: string,
  kind: string,
): BusinessMediaAssetRecord {
  return {
    id: `media-${randomUUID()}`,
    businessId,
    kind,
    sourceUrl: MEDIA_PLACEHOLDER_SRC,
    storagePath: "",
    altText: "Placeholder media",
    status: "placeholder",
    sortOrder: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export async function listBusinessMediaAssets(businessId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_media_assets?select=id,business_id,kind,source_url,storage_path,alt_text,status,sort_order,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&order=sort_order.asc,created_at.asc`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows.map(mapMediaAsset);
    }

    return [];
  }

  return demoMedia.get(businessId)?.slice() ?? [];
}

export async function createBusinessMediaAsset(
  businessId: string,
  input: BusinessMediaAssetInput,
) {
  const safeKind = input.kind.trim();
  const safeAltText = input.altText?.trim() || "Placeholder media";
  const record: BusinessMediaAssetRecord = {
    id: `media-${randomUUID()}`,
    businessId,
    kind: safeKind,
    sourceUrl: MEDIA_PLACEHOLDER_SRC,
    storagePath: "",
    altText: safeAltText,
    status: "placeholder",
    sortOrder: input.sortOrder ?? 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/business_media_assets`, {
      method: "POST",
      body: JSON.stringify({
        business_id: businessId,
        kind: record.kind,
        source_url: "",
        storage_path: "",
        alt_text: record.altText,
        status: record.status,
        sort_order: record.sortOrder,
      }),
    });

    if (!response?.ok) {
      throw new Error("Media kaydı oluşturulamadı.");
    }

    return record;
  }

  const current = demoMedia.get(businessId) ?? [];
  demoMedia.set(businessId, [record, ...current]);
  return record;
}
