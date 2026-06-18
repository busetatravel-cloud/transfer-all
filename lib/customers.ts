import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessCustomerRecord = {
  id: string;
  businessId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  language: string | null;
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
  country?: string;
  language?: string;
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
    country: (row.country as string | null) ?? null,
    language: (row.language as string | null) ?? null,
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

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_customers?select=id,business_id,full_name,email,phone,country,language,source,notes,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
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
    country: input.country?.trim() || null,
    language: input.language?.trim() || null,
    source: input.source?.trim() || "manual",
    notes: input.notes?.trim() || "",
    active: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/business_customers`, {
      method: "POST",
      body: JSON.stringify({
        business_id: safeBusinessId,
        full_name: record.fullName,
        email: record.email,
        phone: record.phone,
        country: record.country,
        language: record.language,
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

function normalizeEmail(value?: string) {
  const safe = value?.trim().toLowerCase() ?? "";
  return safe || null;
}

function normalizePhone(value?: string) {
  const safe = value?.trim() ?? "";
  return safe || null;
}

async function findBusinessCustomerByContact(
  businessId: string,
  email?: string,
  phone?: string,
) {
  if (!hasSupabaseConnection()) {
    const customers = demoCustomers.get(businessId) ?? [];
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    return (
      customers.find((entry) =>
        normalizedEmail ? entry.email?.trim().toLowerCase() === normalizedEmail : false,
      ) ??
      customers.find((entry) =>
        normalizedPhone ? entry.phone?.trim() === normalizedPhone : false,
      ) ??
      null
    );
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (normalizedEmail) {
    const emailRows = await listBusinessCustomers(businessId);
    const matched = emailRows.find(
      (entry) => entry.email?.trim().toLowerCase() === normalizedEmail,
    );

    if (matched) {
      return matched;
    }
  }

  if (normalizedPhone) {
    const phoneRows = await listBusinessCustomers(businessId);
    return (
      phoneRows.find((entry) => entry.phone?.trim() === normalizedPhone) ?? null
    );
  }

  return null;
}

export async function updateBusinessCustomerRecord(
  businessId: string,
  customerId: string,
  input: Partial<BusinessCustomerInput>,
) {
  const safeBusinessId = businessId.trim();
  const safeCustomerId = customerId.trim();

  if (!safeBusinessId || !safeCustomerId) {
    throw new Error("Musteri bulunamadi.");
  }

  const next = {
    fullName: input.fullName?.trim(),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    country: input.country?.trim() || null,
    language: input.language?.trim() || null,
    source: input.source?.trim(),
    notes: input.notes?.trim(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_customers?id=eq.${encodeURIComponent(safeCustomerId)}&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...(next.fullName !== undefined ? { full_name: next.fullName } : {}),
          ...(next.email !== undefined ? { email: next.email } : {}),
          ...(next.phone !== undefined ? { phone: next.phone } : {}),
          ...(next.country !== undefined ? { country: next.country } : {}),
          ...(next.language !== undefined ? { language: next.language } : {}),
          ...(next.source !== undefined ? { source: next.source } : {}),
          ...(next.notes !== undefined ? { notes: next.notes } : {}),
          updated_at: nowIso(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Musteri guncellenemedi.");
    }

    return null;
  }

  const current = demoCustomers.get(safeBusinessId) ?? [];
  const updated = current.map((entry) =>
    entry.id === safeCustomerId
      ? {
          ...entry,
          fullName: next.fullName ?? entry.fullName,
          email: next.email ?? entry.email,
          phone: next.phone ?? entry.phone,
          country: next.country ?? entry.country,
          language: next.language ?? entry.language,
          source: next.source ?? entry.source,
          notes: next.notes ?? entry.notes,
          updatedAt: nowIso(),
        }
      : entry,
  );
  demoCustomers.set(safeBusinessId, updated);
  return updated.find((entry) => entry.id === safeCustomerId) ?? null;
}

export async function upsertBusinessCustomerFromReservation(
  businessId: string,
  input: BusinessCustomerInput,
) {
  const safeBusinessId = businessId.trim();
  const safeFullName = input.fullName.trim();

  if (!safeBusinessId || !safeFullName) {
    throw new Error("Musteri kaydi icin ad gerekli.");
  }

  const existing = await findBusinessCustomerByContact(
    safeBusinessId,
    input.email,
    input.phone,
  );

  if (existing) {
    return (await updateBusinessCustomerRecord(safeBusinessId, existing.id, {
      fullName: safeFullName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      language: input.language,
      source: input.source,
      notes: input.notes,
    })) ?? existing;
  }

  return await createBusinessCustomer(safeBusinessId, input);
}
