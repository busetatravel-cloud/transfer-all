import "server-only";

import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/password";
import type { SessionRole } from "@/lib/session";
import {
  isReservedPlatformDomain,
  normalizeDomain,
} from "@/lib/platform";
import { getSupabaseConfig } from "@/lib/supabase-config";

export type BusinessRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  active: boolean;
  packageName: string | null;
  packageStart: string | null;
  packageEnd: string | null;
  domain: string | null;
  domainStatus: "pending" | "verified" | "active";
  createdAt: string;
  updatedAt: string;
};

export type UserRecord = {
  id: string;
  businessId: string | null;
  role: SessionRole;
  email: string;
  passwordHash: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusinessCreateInput = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  domain: string;
  adminEmail: string;
  adminPassword: string;
};

export type BusinessDomainUpdateInput = {
  domain: string;
  domainStatus: BusinessRecord["domainStatus"];
};

export type BusinessCreateResult = {
  business: BusinessRecord;
  admin: UserRecord;
};

const demoBusinesses: BusinessRecord[] = [
  {
    id: "business-demo-1",
    name: "Buse Transfer",
    email: "info@busetatransfer.com",
    phone: "+90 555 000 00 00",
    whatsapp: "+90 555 000 00 00",
    logoUrl: null,
    active: true,
    packageName: "Starter",
    packageStart: "2026-06-01T00:00:00.000Z",
    packageEnd: "2026-07-01T00:00:00.000Z",
    domain: "demo-transfer.local",
    domainStatus: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
];

const demoUsers: UserRecord[] = [
  {
    id: "super-admin-1",
    businessId: null,
    role: "SUPER_ADMIN",
    email: "super@busetatransfer.com",
    passwordHash: hashPassword("superadmin123"),
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "business-admin-1",
    businessId: "business-demo-1",
    role: "BUSINESS_ADMIN",
    email: "demo@busetatransfer.com",
    passwordHash: hashPassword("business123"),
    active: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
];

function normalizeStoredDomain(value: string | null | undefined) {
  const normalized = normalizeDomain(value);
  return normalized || null;
}

function fromSupabaseBusiness(row: Record<string, unknown>): BusinessRecord {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: (row.phone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    active: Boolean(row.active ?? false),
    packageName: (row.package_name as string | null) ?? null,
    packageStart: (row.package_start as string | null) ?? null,
    packageEnd: (row.package_end as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    domainStatus: (row.domain_status as BusinessRecord["domainStatus"]) ?? "pending",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function fromSupabaseUser(row: Record<string, unknown>): UserRecord {
  return {
    id: String(row.id ?? ""),
    businessId: (row.business_id as string | null) ?? null,
    role: (row.role as SessionRole) ?? "BUSINESS_ADMIN",
    email: String(row.email ?? ""),
    passwordHash: String(row.password_hash ?? ""),
    active: Boolean(row.active ?? false),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
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

async function supabaseRpc<T>(name: string, body: Record<string, unknown>) {
  const response = await supabaseFetch(`/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response || !response.ok) {
    return null;
  }

  return (await response.json()) as T;
}

export function getDemoUserByEmail(email: string) {
  return demoUsers.find(
    (record) => record.email.toLowerCase() === email.toLowerCase(),
  );
}

export function getDemoBusinessById(id: string) {
  return demoBusinesses.find((record) => record.id === id) ?? null;
}

export async function findUserByEmail(email: string) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/users?select=id,business_id,role,email,password_hash,active,created_at,updated_at&email=eq.${encodeURIComponent(
        email,
      )}&limit=1`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows[0] ? fromSupabaseUser(rows[0]) : null;
    }

    return null;
  }

  return getDemoUserByEmail(email) ?? null;
}

export async function listBusinesses() {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,package_name,package_start,package_end,domain,domain_status,created_at,updated_at&order=created_at.desc`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows.map(fromSupabaseBusiness);
    }

    return [];
  }

  return demoBusinesses.slice();
}

export async function getBusinessById(id: string) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,package_name,package_start,package_end,domain,domain_status,created_at,updated_at&id=eq.${encodeURIComponent(
        id,
      )}&limit=1`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows[0] ? fromSupabaseBusiness(rows[0]) : null;
    }

    return null;
  }

  return getDemoBusinessById(id);
}

export async function getBusinessByDomain(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return null;
  }

  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,package_name,package_start,package_end,domain,domain_status,created_at,updated_at&domain=eq.${encodeURIComponent(
        normalizedDomain,
      )}&limit=1`,
    );

    if (response?.ok) {
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows[0] ? fromSupabaseBusiness(rows[0]) : null;
    }

    return null;
  }

  return (
    demoBusinesses.find(
      (business) => business.domain?.toLowerCase() === normalizedDomain,
    ) ?? null
  );
}

export async function getActiveBusinessByDomain(domain: string) {
  const business = await getBusinessByDomain(domain);

  if (!business || business.domainStatus !== "active" || !business.active) {
    return null;
  }

  return business;
}

export async function createBusinessWithAdmin(input: BusinessCreateInput) {
  const adminPasswordHash = hashPassword(input.adminPassword);
  const config = getSupabaseConfig();
  const normalizedDomain = normalizeStoredDomain(input.domain);

  if (normalizedDomain && isReservedPlatformDomain(normalizedDomain)) {
    throw new Error("Platform domain business domain olarak kullanılamaz.");
  }

  if (config) {
    const data = await supabaseRpc<{
      business_id: string;
      user_id: string;
    }>("create_business_with_admin", {
      p_name: input.name,
      p_email: input.email,
      p_phone: input.phone || null,
      p_whatsapp: input.whatsapp || null,
      p_domain: normalizedDomain,
      p_admin_email: input.adminEmail,
      p_admin_password_hash: adminPasswordHash,
    });

    if (!data?.business_id || !data.user_id) {
      throw new Error("Business olusturulamadi.");
    }

    const business = await getBusinessById(data.business_id);

    if (!business) {
      throw new Error("Business kaydi okunamadi.");
    }

    return {
      business,
      admin: {
        id: data.user_id,
        businessId: data.business_id,
        role: "BUSINESS_ADMIN",
        email: input.adminEmail,
        passwordHash: adminPasswordHash,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies UserRecord,
    } satisfies BusinessCreateResult;
  }

  const businessId = `business-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  const now = new Date().toISOString();

  if (
    demoBusinesses.some(
      (business) =>
        business.email.toLowerCase() === input.email.toLowerCase() ||
        (normalizedDomain &&
          business.domain?.toLowerCase() === normalizedDomain),
    )
  ) {
    throw new Error("Business email veya domain zaten kullaniliyor.");
  }

  if (
    demoUsers.some(
      (user) =>
        user.email.toLowerCase() === input.adminEmail.toLowerCase() &&
        user.role === "BUSINESS_ADMIN",
    )
  ) {
    throw new Error("Primary BUSINESS_ADMIN zaten mevcut.");
  }

  const business: BusinessRecord = {
    id: businessId,
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    whatsapp: input.whatsapp || null,
    logoUrl: null,
    active: true,
    packageName: "Starter",
    packageStart: now,
    packageEnd: null,
    domain: normalizedDomain,
    domainStatus: normalizedDomain ? "pending" : "pending",
    createdAt: now,
    updatedAt: now,
  };

  const admin: UserRecord = {
    id: userId,
    businessId,
    role: "BUSINESS_ADMIN",
    email: input.adminEmail,
    passwordHash: adminPasswordHash,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  demoBusinesses.unshift(business);
  demoUsers.push(admin);

  return { business, admin } satisfies BusinessCreateResult;
}

export async function updateBusinessDomainRecord(
  businessId: string,
  input: BusinessDomainUpdateInput,
) {
  const config = getSupabaseConfig();
  const normalizedDomain = normalizeStoredDomain(input.domain);

  if (normalizedDomain && isReservedPlatformDomain(normalizedDomain)) {
    throw new Error("Platform domain business domain olarak kullanılamaz.");
  }

  if (config) {
    const existing = normalizedDomain
      ? await supabaseFetch(
          `/businesses?select=id&domain=eq.${encodeURIComponent(
            normalizedDomain,
          )}&limit=1`,
        )
      : null;

    if (existing?.ok) {
      const rows = (await existing.json()) as Array<Record<string, unknown>>;
      if (rows[0] && String(rows[0].id ?? "") !== businessId) {
        throw new Error("Domain başka bir business tarafından kullanılıyor.");
      }
    }

    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          domain: normalizedDomain,
          domain_status: normalizedDomain ? input.domainStatus : "pending",
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Domain güncellenemedi.");
    }

    const business = await getBusinessById(businessId);

    if (!business) {
      throw new Error("Business kaydi okunamadi.");
    }

    return business;
  }

  const existing = demoBusinesses.find((business) => business.id === businessId);

  if (!existing) {
    throw new Error("Business bulunamadi.");
  }

  if (
    normalizedDomain &&
    demoBusinesses.some(
      (business) =>
        business.id !== businessId &&
        business.domain?.toLowerCase() === normalizedDomain,
    )
  ) {
    throw new Error("Domain başka bir business tarafından kullanılıyor.");
  }

  existing.domain = normalizedDomain;
  existing.domainStatus = normalizedDomain ? input.domainStatus : "pending";
  existing.updatedAt = new Date().toISOString();

  return existing;
}

export type BusinessUpdateInput = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  logoUrl: string;
};

export async function updateBusinessRecord(
  businessId: string,
  input: BusinessUpdateInput,
) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: input.name.trim(),
          email: input.email.trim(),
          phone: input.phone.trim() || null,
          whatsapp: input.whatsapp.trim() || null,
          logo_url: input.logoUrl.trim() || null,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Business guncellenemedi.");
    }

    const business = await getBusinessById(businessId);

    if (!business) {
      throw new Error("Business kaydi okunamadi.");
    }

    return business;
  }

  const existing = demoBusinesses.find((business) => business.id === businessId);

  if (!existing) {
    throw new Error("Business bulunamadi.");
  }

  if (
    demoBusinesses.some(
      (business) =>
        business.id !== businessId &&
        business.email.toLowerCase() === input.email.toLowerCase(),
    )
  ) {
    throw new Error("Business email zaten kullaniliyor.");
  }

  existing.name = input.name.trim();
  existing.email = input.email.trim();
  existing.phone = input.phone.trim() || null;
  existing.whatsapp = input.whatsapp.trim() || null;
  existing.logoUrl = input.logoUrl.trim() || null;
  existing.updatedAt = new Date().toISOString();

  return existing;
}
