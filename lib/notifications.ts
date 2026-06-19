import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessNotificationType =
  | "Yeni rezervasyon"
  | "Yeni görev"
  | "Ödeme bekliyor"
  | "Voucher hazır"
  | "Domain bekliyor"
  | "Yayın bekliyor";

export type BusinessNotificationStatus = "unread" | "read";

export type BusinessNotificationRecord = {
  id: string;
  businessId: string;
  type: BusinessNotificationType;
  title: string;
  message: string;
  status: BusinessNotificationStatus;
  relatedType: string | null;
  relatedId: string | null;
  createdAt: string;
};

export type BusinessNotificationInput = {
  type: BusinessNotificationType;
  title: string;
  message: string;
  relatedType?: string;
  relatedId?: string;
  status?: BusinessNotificationStatus;
};

const demoNotifications = new Map<string, BusinessNotificationRecord[]>([]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function mapNotification(row: Record<string, unknown>): BusinessNotificationRecord {
  const status = String(row.status ?? "unread") as BusinessNotificationStatus;
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    type: String(row.type ?? "Yeni rezervasyon") as BusinessNotificationType,
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    status: status === "read" ? "read" : "unread",
    relatedType: (row.related_type as string | null) ?? null,
    relatedId: (row.related_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
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

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response?.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

export async function listNotifications(businessId: string) {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return [];
  }

  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/business_notifications?select=id,business_id,type,title,message,status,related_type,related_id,created_at&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&order=created_at.desc`,
    );

    return rows.map(mapNotification);
  }

  return demoNotifications.get(safeBusinessId)?.slice() ?? [];
}

export async function getUnreadNotificationCount(businessId: string) {
  const notifications = await listNotifications(businessId);
  return notifications.filter((item) => item.status === "unread").length;
}

export async function createNotification(
  businessId: string,
  input: BusinessNotificationInput,
) {
  const safeBusinessId = businessId.trim();
  const title = normalizeText(input.title);
  const message = normalizeText(input.message);

  if (!safeBusinessId || !title || !message) {
    return null;
  }

  const record: BusinessNotificationRecord = {
    id: `notification-${randomUUID()}`,
    businessId: safeBusinessId,
    type: input.type,
    title,
    message,
    status: input.status ?? "unread",
    relatedType: normalizeText(input.relatedType) || null,
    relatedId: normalizeText(input.relatedId) || null,
    createdAt: nowIso(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch("/business_notifications", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: record.businessId,
        type: record.type,
        title: record.title,
        message: record.message,
        status: record.status,
        related_type: record.relatedType,
        related_id: record.relatedId,
        created_at: record.createdAt,
      }),
    });

    if (!response?.ok) {
      throw new Error("Bildirim oluşturulamadı.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapNotification(rows[0]) : record;
  }

  const current = demoNotifications.get(safeBusinessId) ?? [];
  demoNotifications.set(safeBusinessId, [record, ...current]);
  return record;
}

export async function markNotificationAsRead(
  businessId: string,
  notificationId: string,
) {
  const safeBusinessId = businessId.trim();
  const safeNotificationId = notificationId.trim();

  if (!safeBusinessId || !safeNotificationId) {
    throw new Error("Bildirim bulunamadı.");
  }

  if (!hasSupabaseConnection()) {
    const current = demoNotifications.get(safeBusinessId) ?? [];
    demoNotifications.set(
      safeBusinessId,
      current.map((item) =>
        item.id === safeNotificationId ? { ...item, status: "read" } : item,
      ),
    );
    return true;
  }

  const response = await supabaseFetch(
    `/business_notifications?id=eq.${encodeURIComponent(safeNotificationId)}&business_id=eq.${encodeURIComponent(
      safeBusinessId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "read" }),
    },
  );

  if (!response?.ok) {
    throw new Error("Bildirim güncellenemedi.");
  }

  return true;
}

export async function markNotificationAsUnread(
  businessId: string,
  notificationId: string,
) {
  const safeBusinessId = businessId.trim();
  const safeNotificationId = notificationId.trim();

  if (!safeBusinessId || !safeNotificationId) {
    throw new Error("Bildirim bulunamadı.");
  }

  if (!hasSupabaseConnection()) {
    const current = demoNotifications.get(safeBusinessId) ?? [];
    demoNotifications.set(
      safeBusinessId,
      current.map((item) =>
        item.id === safeNotificationId ? { ...item, status: "unread" } : item,
      ),
    );
    return true;
  }

  const response = await supabaseFetch(
    `/business_notifications?id=eq.${encodeURIComponent(safeNotificationId)}&business_id=eq.${encodeURIComponent(
      safeBusinessId,
    )}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "unread" }),
    },
  );

  if (!response?.ok) {
    throw new Error("Bildirim güncellenemedi.");
  }

  return true;
}

