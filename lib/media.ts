import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, getSupabaseUrl, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessMediaSlot =
  | "logo"
  | "hero"
  | "service_cover"
  | "vehicle_cover"
  | "vehicle_interior"
  | "vehicle_exterior"
  | "vehicle_trunk"
  | "vehicle_seat"
  | "route_cover"
  | "blog_cover";

export type BusinessMediaMetadata = {
  fileName?: string;
  previewDataUrl?: string;
  cropX?: number;
  cropY?: number;
  zoom?: number;
  slot?: BusinessMediaSlot | string;
  altText?: string;
  cover?: boolean;
};

export type BusinessMediaAssetRecord = {
  id: string;
  businessId: string;
  kind: BusinessMediaSlot | string;
  sourceUrl: string;
  storagePath: string;
  altText: string;
  metadata: BusinessMediaMetadata | null;
  status: "placeholder" | "ready" | "failed";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMediaAssetInput = {
  kind: BusinessMediaSlot | string;
  sourceUrl?: string;
  storagePath?: string;
  altText?: string;
  metadata?: BusinessMediaMetadata | null;
  status?: BusinessMediaAssetRecord["status"];
  sortOrder?: number;
};

export const BUSINESS_MEDIA_SLOTS: Array<{
  kind: BusinessMediaSlot;
  label: string;
  description: string;
}> = [
  { kind: "logo", label: "Logo", description: "Marka kimliği" },
  { kind: "hero", label: "Hero", description: "Ana sayfa kapak görseli" },
  { kind: "service_cover", label: "Hizmet kapak", description: "Hizmet kapak görseli" },
  { kind: "vehicle_cover", label: "Araç kapak", description: "Araç ana görseli" },
  { kind: "vehicle_interior", label: "İç görünüm", description: "Araç iç fotoğrafı" },
  { kind: "vehicle_exterior", label: "Dış görünüm", description: "Araç dış fotoğrafı" },
  { kind: "vehicle_trunk", label: "Bagaj", description: "Araç bagaj alanı" },
  { kind: "vehicle_seat", label: "Koltuk", description: "Araç koltuk düzeni" },
  { kind: "route_cover", label: "Rota kapak", description: "Rota kapak görseli" },
  { kind: "blog_cover", label: "Blog kapak", description: "Blog kapak görseli" },
];

export const MEDIA_PLACEHOLDER_SRC =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='800' fill='%23e2e8f0'/%3E%3Cpath d='M200 560l180-180 150 150 120-120 250 250H200z' fill='%2394a3b8'/%3E%3Ccircle cx='430' cy='300' r='70' fill='%23cbd5e1'/%3E%3C/svg%3E";

export const BUSINESS_MEDIA_BUCKET = "business-media";

const demoMedia = new Map<string, BusinessMediaAssetRecord[]>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeStorageSegment(value: string) {
  return value
    .trim()
    .replace(/[\\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function buildBusinessMediaStoragePath(
  businessId: string,
  slot: BusinessMediaSlot | string,
  fileName: string,
) {
  const safeBusinessId = normalizeStorageSegment(businessId) || "business";
  const safeSlot = normalizeStorageSegment(slot) || "media";
  const rawFileName = String(fileName ?? "").trim() || "upload";
  const parts = rawFileName.split(".");
  const extension = parts.length > 1 ? parts.pop() ?? "" : "";
  const baseName = normalizeStorageSegment(parts.join(".")) || "file";
  const safeFileName = extension
    ? `${baseName}.${normalizeStorageSegment(extension) || "bin"}`
    : baseName;

  return `${safeBusinessId}/${safeSlot}/${safeFileName}`;
}

export function buildBusinessMediaPublicUrl(storagePath: string) {
  const baseUrl = getSupabaseUrl();

  if (!baseUrl) {
    return "";
  }

  const encodedPath = storagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${baseUrl}/storage/v1/object/public/${BUSINESS_MEDIA_BUCKET}/${encodedPath}`;
}

async function uploadBusinessMediaObject(
  storagePath: string,
  file: File,
) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  const response = await fetch(
    `${config.url}/storage/v1/object/${BUSINESS_MEDIA_BUCKET}/${storagePath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/")}`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: new Uint8Array(await file.arrayBuffer()),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message.trim() || "Medya yuklenemedi.");
  }

  return {
    storagePath,
    sourceUrl: buildBusinessMediaPublicUrl(storagePath),
  };
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
  const metadata = row.metadata;
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    kind: String(row.kind ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    storagePath: String(row.storage_path ?? ""),
    altText: String(row.alt_text ?? ""),
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as BusinessMediaMetadata)
        : null,
    status: (row.status as BusinessMediaAssetRecord["status"]) ?? "placeholder",
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeMediaKind(kind: string) {
  return kind.trim().toLowerCase();
}

function pickLatestMediaAsset(
  assets: BusinessMediaAssetRecord[],
  kind: BusinessMediaSlot | string,
) {
  const normalizedKind = normalizeMediaKind(kind);

  return (
    assets
      .filter((asset) => normalizeMediaKind(asset.kind) === normalizedKind)
      .sort((left, right) => {
        if (left.sortOrder !== right.sortOrder) {
          return left.sortOrder - right.sortOrder;
        }

        return left.createdAt.localeCompare(right.createdAt);
      })[0] ?? null
  );
}

export function getSafeMediaSourceUrl(
  asset?: Pick<BusinessMediaAssetRecord, "sourceUrl" | "metadata"> | null,
) {
  return asset?.metadata?.previewDataUrl?.trim() || asset?.sourceUrl?.trim() || MEDIA_PLACEHOLDER_SRC;
}

export function resolveBusinessMediaSourceUrl(
  assets: BusinessMediaAssetRecord[],
  kind: BusinessMediaSlot | string,
) {
  return getSafeMediaSourceUrl(pickLatestMediaAsset(assets, kind));
}

export function resolveBusinessMediaAltText(
  assets: BusinessMediaAssetRecord[],
  kind: BusinessMediaSlot | string,
  fallback: string,
) {
  const asset = pickLatestMediaAsset(assets, kind);
  return asset?.metadata?.altText?.trim() || asset?.altText?.trim() || fallback;
}

export async function uploadBusinessMediaFile(
  businessId: string,
  slot: BusinessMediaSlot | string,
  file: File,
) {
  const storagePath = buildBusinessMediaStoragePath(businessId, slot, file.name);
  const uploaded = await uploadBusinessMediaObject(storagePath, file);
  return uploaded;
}

export function buildMediaPlaceholderAsset(
  businessId: string,
  kind: string,
): BusinessMediaAssetRecord {
  const now = nowIso();
  return {
    id: `media-${randomUUID()}`,
    businessId,
    kind,
    sourceUrl: MEDIA_PLACEHOLDER_SRC,
    storagePath: "",
    altText: "Placeholder media",
    metadata: null,
    status: "placeholder",
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listBusinessMediaAssets(businessId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_media_assets?select=id,business_id,kind,source_url,storage_path,alt_text,metadata,status,sort_order,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&order=sort_order.asc,created_at.asc`,
    );

    if (response?.ok) {
      const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
      return rows.map(mapMediaAsset);
    }

    return [];
  }

  return demoMedia.get(businessId)?.slice() ?? [];
}

async function readExistingBusinessMediaAsset(
  businessId: string,
  kind: BusinessMediaSlot | string,
) {
  if (!hasSupabaseConnection()) {
    const assets = demoMedia.get(businessId) ?? [];
    return pickLatestMediaAsset(assets, kind);
  }

  const response = await supabaseFetch(
    `/business_media_assets?select=id,business_id,kind,source_url,storage_path,alt_text,metadata,status,sort_order,created_at,updated_at&business_id=eq.${encodeURIComponent(
      businessId,
    )}&kind=eq.${encodeURIComponent(kind)}&limit=1`,
  );

  if (!response?.ok) {
    return null;
  }

  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  return rows[0] ? mapMediaAsset(rows[0]) : null;
}

export async function upsertBusinessMediaAsset(
  businessId: string,
  input: BusinessMediaAssetInput,
) {
  const safeKind = input.kind.trim();
  const safeSourceUrl = input.sourceUrl?.trim() ?? "";
  const safeStoragePath = input.storagePath?.trim() ?? "";
  const safeAltText = input.altText?.trim() || "Placeholder media";
  const metadata = input.metadata ?? null;
  const status = input.status ?? (safeSourceUrl ? "ready" : "placeholder");
  const now = nowIso();
  const nextRecord: BusinessMediaAssetRecord = {
    id: `media-${randomUUID()}`,
    businessId,
    kind: safeKind,
    sourceUrl: safeSourceUrl || MEDIA_PLACEHOLDER_SRC,
    storagePath: safeStoragePath,
    altText: safeAltText,
    metadata,
    status,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };

  if (hasSupabaseConnection()) {
    const existing = await readExistingBusinessMediaAsset(businessId, safeKind);
    const response = await supabaseFetch(
      existing
        ? `/business_media_assets?id=eq.${encodeURIComponent(existing.id)}&business_id=eq.${encodeURIComponent(
            businessId,
          )}`
        : `/business_media_assets`,
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify(
          existing
            ? {
                source_url: nextRecord.sourceUrl,
                storage_path: nextRecord.storagePath,
                alt_text: nextRecord.altText,
                metadata: nextRecord.metadata,
                status: nextRecord.status,
                sort_order: nextRecord.sortOrder,
                updated_at: now,
              }
            : {
                business_id: businessId,
                kind: nextRecord.kind,
                source_url: nextRecord.sourceUrl,
                storage_path: nextRecord.storagePath,
                alt_text: nextRecord.altText,
                metadata: nextRecord.metadata,
                status: nextRecord.status,
                sort_order: nextRecord.sortOrder,
                created_at: now,
                updated_at: now,
              },
        ),
      },
    );

    if (!response?.ok) {
      throw new Error("Media kaydi olusturulamadi.");
    }

    if (existing) {
      return {
        ...existing,
        sourceUrl: nextRecord.sourceUrl,
        storagePath: nextRecord.storagePath,
        altText: nextRecord.altText,
        metadata: nextRecord.metadata,
        status: nextRecord.status,
        sortOrder: nextRecord.sortOrder,
        updatedAt: now,
      };
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapMediaAsset(rows[0]) : nextRecord;
  }

  const current = demoMedia.get(businessId) ?? [];
  const nextMedia = [
    nextRecord,
    ...current.filter(
      (asset) => normalizeMediaKind(asset.kind) !== normalizeMediaKind(safeKind),
    ),
  ];
  demoMedia.set(businessId, nextMedia);
  return nextRecord;
}

export async function createBusinessMediaAsset(
  businessId: string,
  input: BusinessMediaAssetInput,
) {
  return upsertBusinessMediaAsset(businessId, input);
}

export async function deleteBusinessMediaAsset(
  businessId: string,
  kind: BusinessMediaSlot | string,
) {
  const safeKind = kind.trim();

  if (hasSupabaseConnection()) {
    const existing = await readExistingBusinessMediaAsset(businessId, safeKind);

    if (!existing) {
      return true;
    }

    const response = await supabaseFetch(
      `/business_media_assets?id=eq.${encodeURIComponent(existing.id)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Media kaydi silinemedi.");
    }

    return true;
  }

  const current = demoMedia.get(businessId) ?? [];
  demoMedia.set(
    businessId,
    current.filter((asset) => normalizeMediaKind(asset.kind) !== normalizeMediaKind(safeKind)),
  );
  return true;
}
