import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig } from "@/lib/supabase-config";

export type BusinessCustomerRecord = {
  id: string;
  businessId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  source: string;
  notes: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusinessCustomerInput = {
  fullName: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
};

const demoCustomers = new Map<string, BusinessCustomerRecord[]>([]);

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

function mapCustomer(row: Record<string, unknown>): BusinessCustomerRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    fullName: String(row.full_name ?? ""),
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    source: String(row.source ?? "manual"),
    notes: String(row.notes ?? ""),
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function listBusinessCustomers(businessId: string) {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return [];
  }

  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/business_customers?select=id,business_id,full_name,email,phone,source,notes,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&order=created_at.desc`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows.map(mapCustomer);
    }

    return [];
  }

  return demoCustomers.get(safeBusinessId)?.slice() ?? [];
}

export async function createBusinessCustomer(
  businessId: string,
  input: BusinessCustomerInput,
) {
  const safeBusinessId = businessId.trim();
  const safeFullName = input.fullName.trim();

  if (!safeBusinessId || !safeFullName) {
    throw new Error("Customer kaydı için business ve ad gerekli.");
  }

  const record: BusinessCustomerRecord = {
    id: `customer-${randomUUID()}`,
    businessId: safeBusinessId,
    fullName: safeFullName,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    source: input.source?.trim() || "manual",
    notes: input.notes?.trim() || "",
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(`/business_customers`, {
      method: "POST",
      body: JSON.stringify({
        business_id: safeBusinessId,
        full_name: record.fullName,
        email: record.email,
        phone: record.phone,
        source: record.source,
        notes: record.notes,
        active: record.active,
      }),
    });

    if (!response?.ok) {
      throw new Error("Customer kaydı oluşturulamadı.");
    }

    return record;
  }

  const current = demoCustomers.get(safeBusinessId) ?? [];
  demoCustomers.set(safeBusinessId, [record, ...current]);
  return record;
}
