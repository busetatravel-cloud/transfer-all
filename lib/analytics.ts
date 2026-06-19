import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessAnalyticsEventRecord = {
  id: string;
  businessId: string;
  eventName: "visit" | "conversion" | string;
  pagePath: string;
  pageType: string;
  referrer: string | null;
  userAgent: string | null;
  visitorId: string | null;
  createdAt: string;
};

export type BusinessAnalyticsEventInput = {
  eventName?: "visit" | "conversion" | string;
  pagePath: string;
  pageType: string;
  referrer?: string;
  userAgent?: string;
  visitorId?: string;
};

export type BusinessAnalyticsSummary = {
  todayVisits: number;
  totalVisits: number;
  conversions: number;
  conversionRate: number;
  popularPages: Array<{
    pagePath: string;
    pageType: string;
    visits: number;
  }>;
  recentEvents: BusinessAnalyticsEventRecord[];
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
    eventName: String(row.event_name ?? "visit"),
    pagePath: String(row.page_path ?? ""),
    pageType: String(row.page_type ?? "unknown"),
    referrer: (row.referrer as string | null) ?? null,
    userAgent: (row.user_agent as string | null) ?? null,
    visitorId: (row.visitor_id as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

function normalizeEventName(value?: string) {
  const normalized = String(value ?? "visit").trim().toLowerCase();
  return normalized === "conversion" ? "conversion" : "visit";
}

function normalizePagePath(value: string) {
  const safe = value.trim();
  return safe.startsWith("/") ? safe : `/${safe}`;
}

function buildRecord(businessId: string, input: BusinessAnalyticsEventInput): BusinessAnalyticsEventRecord {
  return {
    id: `event-${randomUUID()}`,
    businessId,
    eventName: normalizeEventName(input.eventName),
    pagePath: normalizePagePath(input.pagePath),
    pageType: String(input.pageType ?? "unknown").trim() || "unknown",
    referrer: input.referrer?.trim() || null,
    userAgent: input.userAgent?.trim() || null,
    visitorId: input.visitorId?.trim() || null,
    createdAt: nowIso(),
  };
}

export async function recordBusinessAnalyticsEvent(
  businessId: string,
  input: BusinessAnalyticsEventInput,
) {
  const safeBusinessId = businessId.trim();
  const safePagePath = String(input.pagePath ?? "").trim();
  const safePageType = String(input.pageType ?? "").trim();

  if (!safeBusinessId || !safePagePath || !safePageType) {
    throw new Error("Analytics kaydı için business, path ve pageType gerekli.");
  }

  const record = buildRecord(safeBusinessId, input);

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/business_analytics_events`, {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: record.businessId,
        event_name: record.eventName,
        page_path: record.pagePath,
        page_type: record.pageType,
        referrer: record.referrer,
        user_agent: record.userAgent,
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
      `/business_analytics_events?select=id,business_id,event_name,page_path,page_type,referrer,user_agent,visitor_id,created_at&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&order=created_at.desc`,
    );

    if (response?.ok) {
      const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
      return rows.map(mapAnalyticsEvent);
    }

    return [];
  }

  return demoEvents.get(safeBusinessId)?.slice() ?? [];
}

export async function getBusinessAnalyticsSummary(
  businessId: string,
): Promise<BusinessAnalyticsSummary> {
  const events = await listBusinessAnalyticsEvents(businessId);
  const todayKey = new Date().toISOString().slice(0, 10);
  const visits = events.filter((event) => event.eventName === "visit");
  const conversions = events.filter((event) => event.eventName === "conversion");

  const pageCounts = new Map<string, { pageType: string; visits: number }>();
  for (const event of visits) {
    const current = pageCounts.get(event.pagePath) ?? { pageType: event.pageType, visits: 0 };
    current.visits += 1;
    current.pageType = current.pageType || event.pageType;
    pageCounts.set(event.pagePath, current);
  }

  const popularPages = Array.from(pageCounts.entries())
    .map(([pagePath, value]) => ({
      pagePath,
      pageType: value.pageType,
      visits: value.visits,
    }))
    .sort((left, right) => right.visits - left.visits)
    .slice(0, 5);

  const totalVisits = visits.length;
  const todayVisits = visits.filter((event) => event.createdAt.slice(0, 10) === todayKey).length;
  const conversionCount = conversions.length;

  return {
    todayVisits,
    totalVisits,
    conversions: conversionCount,
    conversionRate: totalVisits > 0 ? Math.round((conversionCount / totalVisits) * 1000) / 10 : 0,
    popularPages,
    recentEvents: events.slice(0, 20),
  };
}
