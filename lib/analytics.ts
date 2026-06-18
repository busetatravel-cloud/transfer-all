import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessAnalyticsEventRecord = {
  id: string;
  businessId: string;
  eventName: string;
  pagePath: string;
  referrer: string | null;
  visitorId: string | null;
  createdAt: string;
};

export type BusinessAnalyticsEventInput = {
  eventName: string;
  pagePath: string;
  referrer?: string;
  visitorId?: string;
};

const demoEvents = new Map<string, BusinessAnalyticsEventRecord[]>([]);

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

function mapAnalyticsEvent(row: Record<string, unknown>): BusinessAnalyticsEventRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    eventName: String(row.event_name ?? ""),
    pagePath: String(row.page_path ?? ""),
    referrer: (row.referrer as string | null) ?? null,
    visitorId: (row.visitor_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function recordBusinessAnalyticsEvent(
  businessId: string,
  input: BusinessAnalyticsEventInput,
) {
  const safeBusinessId = businessId.trim();
  const safeEventName = input.eventName.trim();
  const safePagePath = input.pagePath.trim();

  if (!safeBusinessId || !safeEventName || !safePagePath) {
    throw new Error("Analytics kaydı için business ve event bilgileri gerekli.");
  }

  const record: BusinessAnalyticsEventRecord = {
    id: `event-${randomUUID()}`,
    businessId: safeBusinessId,
    eventName: safeEventName,
    pagePath: safePagePath,
    referrer: input.referrer?.trim() || null,
    visitorId: input.visitorId?.trim() || null,
    createdAt: nowIso(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/business_analytics_events`, {
      method: "POST",
      body: JSON.stringify({
        business_id: safeBusinessId,
        event_name: record.eventName,
        page_path: record.pagePath,
        referrer: record.referrer,
        visitor_id: record.visitorId,
      }),
    });

    if (!response?.ok) {
      throw new Error("Analytics kaydı oluşturulamadı.");
    }

    return record;
  }

  const current = demoEvents.get(safeBusinessId) ?? [];
  demoEvents.set(safeBusinessId, [record, ...current]);
  return record;
}

export async function listBusinessAnalyticsEvents(businessId: string) {
  const safeBusinessId = businessId.trim();
  if (!safeBusinessId) {
    return [];
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_analytics_events?select=id,business_id,event_name,page_path,referrer,visitor_id,created_at&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&order=created_at.desc`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows.map(mapAnalyticsEvent);
    }

    return [];
  }

  return demoEvents.get(safeBusinessId)?.slice() ?? [];
}
