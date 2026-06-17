import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig } from "@/lib/supabase-config";

export type BusinessRequestRecord = {
  id: string;
  businessId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  message: string;
  status: "new" | "in_progress" | "completed" | "archived";
  createdAt: string;
};

type BusinessRequestInput = {
  customerName: string;
  phone: string;
  email: string;
  message: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

const demoRequests = new Map<string, BusinessRequestRecord[]>([
  [
    "business-demo-1",
    [
      {
        id: "request-1",
        businessId: "business-demo-1",
        customerName: "Demo User",
        phone: "+90 555 111 22 33",
        email: "demo@example.com",
        message: "Airport transfer icin teklif istiyorum.",
        status: "new",
        createdAt: "2026-06-10T10:00:00.000Z",
      },
    ],
  ],
]);

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

function mapRequest(row: Record<string, unknown>): BusinessRequestRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    customerName: String(row.customer_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    message: String(row.message ?? ""),
    status: (row.status as BusinessRequestRecord["status"]) ?? "new",
    createdAt: String(row.created_at ?? ""),
  };
}

export async function getBusinessRequests(businessId: string) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/requests?select=id,business_id,customer_name,phone,email,message,status,created_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&order=created_at.desc`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows.map(mapRequest);
    }

    return [];
  }

  return demoRequests.get(businessId)?.slice() ?? [];
}

export async function createBusinessRequest(
  businessId: string,
  input: BusinessRequestInput,
) {
  const payload = {
    business_id: businessId,
    customer_name: input.customerName.trim(),
    phone: input.phone.trim() || null,
    email: normalizeEmail(input.email) || null,
    message: input.message.trim(),
  };

  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(`/requests`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!response?.ok) {
      throw new Error("Talep kaydedilemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<
      Record<string, unknown>
    >;

    if (rows[0]) {
      return mapRequest(rows[0]);
    }

    return {
      id: randomUUID(),
      businessId,
      customerName: payload.customer_name,
      phone: payload.phone,
      email: payload.email,
      message: payload.message,
      status: "new",
      createdAt: nowIso(),
    } satisfies BusinessRequestRecord;
  }

  const record: BusinessRequestRecord = {
    id: `request-${randomUUID()}`,
    businessId,
    customerName: payload.customer_name,
    phone: payload.phone,
    email: payload.email,
    message: payload.message,
    status: "new",
    createdAt: nowIso(),
  };

  const current = demoRequests.get(businessId) ?? [];
  demoRequests.set(businessId, [record, ...current]);
  return record;
}
