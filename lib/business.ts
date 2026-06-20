import "server-only";

import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/password";
import type { SessionRole } from "@/lib/session";
import {
  isReservedPlatformDomain,
  normalizeDomain,
} from "@/lib/platform";
import {
  buildDomainVerificationToken,
  type DomainSslStatus,
  type DomainStatus,
} from "@/lib/domain-utils";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessRecord = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  active: boolean;
  planId: string | null;
  packageName: string | null;
  packageStart: string | null;
  packageEnd: string | null;
  domain: string | null;
  hostname: string | null;
  verificationToken: string | null;
  verifiedAt: string | null;
  activatedAt: string | null;
  lastCheckedAt: string | null;
  sslStatus: DomainSslStatus;
  domainStatus: DomainStatus;
  createdAt: string;
  updatedAt: string;
};

export type UserRecord = {
  id: string;
  businessId: string | null;
  role: SessionRole;
  email: string;
  passwordHash: string;
  passwordPlaintext: string | null;
  passwordChangedAt: string | null;
  deletedAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusinessListRecord = BusinessRecord & {
  admin: {
    id: string;
    email: string;
    password: string | null;
    passwordChangedAt: string | null;
    role: SessionRole | null;
    active: boolean | null;
  } | null;
  adminId: string | null;
  adminEmail: string;
  adminPassword: string | null;
  adminPasswordChangedAt: string | null;
  adminDeletedAt: string | null;
  adminRole: SessionRole | null;
  adminActive: boolean | null;
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
  domain?: string;
  hostname?: string;
  domainStatus?: BusinessRecord["domainStatus"];
  verificationToken?: string | null;
  verifiedAt?: string | null;
  activatedAt?: string | null;
  lastCheckedAt?: string | null;
  sslStatus?: BusinessRecord["sslStatus"] | null;
};

export type BusinessCreateResult = {
  business: BusinessRecord;
  admin: Omit<UserRecord, "passwordHash">;
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
    planId: null,
    packageName: "Starter",
    packageStart: "2026-06-01T00:00:00.000Z",
    packageEnd: "2026-07-01T00:00:00.000Z",
    domain: "demo-transfer.local",
    hostname: "demo-transfer.local",
    verificationToken: "demo-verification-token",
    verifiedAt: "2026-06-01T00:00:00.000Z",
    activatedAt: "2026-06-01T00:00:00.000Z",
    lastCheckedAt: "2026-06-01T00:00:00.000Z",
    sslStatus: "active",
    domainStatus: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  },
];

function buildDemoUsers(): UserRecord[] {
  const users: UserRecord[] = [];
  const superAdminEmail = process.env.DEMO_SUPER_ADMIN_EMAIL?.trim();
  const superAdminPassword = process.env.DEMO_SUPER_ADMIN_PASSWORD?.trim();
  const businessAdminEmail = process.env.DEMO_BUSINESS_ADMIN_EMAIL?.trim();
  const businessAdminPassword = process.env.DEMO_BUSINESS_ADMIN_PASSWORD?.trim();

  if (superAdminEmail && superAdminPassword) {
    users.push({
      id: "super-admin-1",
      businessId: null,
      role: "SUPER_ADMIN",
      email: superAdminEmail.toLowerCase(),
      passwordHash: hashPassword(superAdminPassword),
      passwordPlaintext: superAdminPassword,
      passwordChangedAt: "2026-06-01T00:00:00.000Z",
      deletedAt: null,
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  }

  if (businessAdminEmail && businessAdminPassword) {
    users.push({
      id: "business-admin-1",
      businessId: "business-demo-1",
      role: "BUSINESS_ADMIN",
      email: businessAdminEmail.toLowerCase(),
      passwordHash: hashPassword(businessAdminPassword),
      passwordPlaintext: businessAdminPassword,
      passwordChangedAt: "2026-06-01T00:00:00.000Z",
      deletedAt: null,
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    });
  }

  return users;
}

const demoUsers = buildDemoUsers();

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
    planId: (row.plan_id as string | null) ?? null,
    packageName: (row.package_name as string | null) ?? null,
    packageStart: (row.package_start as string | null) ?? null,
    packageEnd: (row.package_end as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    hostname: (row.hostname as string | null) ?? null,
    verificationToken: (row.verification_token as string | null) ?? null,
    verifiedAt: (row.verified_at as string | null) ?? null,
    activatedAt: (row.activated_at as string | null) ?? null,
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    sslStatus: (row.ssl_status as DomainSslStatus) ?? "pending",
    domainStatus: (row.domain_status as DomainStatus) ?? "pending",
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
    passwordPlaintext: (row.password_plaintext as string | null) ?? null,
    passwordChangedAt: (row.password_changed_at as string | null) ?? null,
    deletedAt: (row.deleted_at as string | null) ?? null,
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

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response) {
    return [];
  }

  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return response.ok ? [] : [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

async function supabaseRpc(name: string, body: Record<string, unknown>) {
  const response = await supabaseFetch(`/rpc/${name}`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response) {
    return {
      ok: false as const,
      status: 0,
      data: null as unknown,
      errorBody: "Supabase baglantisi kurulamadi.",
      rawBody: null as string | null,
    };
  }

  const rawBody = await response.text().catch(() => "");

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      data: null as unknown,
      errorBody: rawBody,
      rawBody,
    };
  }

  let data: unknown = null;

  if (rawBody) {
    try {
      data = JSON.parse(rawBody) as unknown;
    } catch {
      data = null;
    }
  }

  return {
    ok: true as const,
    status: response.status,
    data,
    errorBody: null,
    rawBody,
  };
}

type CreateBusinessRpcResponse = {
  business_id?: string;
  user_id?: string;
  business_name?: string;
  business_email?: string;
  admin_email?: string;
  role?: string;
  business?: {
    id?: string;
    name?: string;
    email?: string;
  };
  admin?: {
    id?: string;
    email?: string;
    role?: string;
  };
};

function parseCreateBusinessRpcResponse(data: unknown) {
  const value = Array.isArray(data) ? data[0] : data;

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as CreateBusinessRpcResponse;

  return {
    businessId: record.business_id ?? record.business?.id ?? "",
    businessName: record.business?.name ?? record.business_name ?? "",
    businessEmail: record.business?.email ?? record.business_email ?? "",
    adminId: record.user_id ?? record.admin?.id ?? "",
    adminEmail: record.admin?.email ?? record.admin_email ?? "",
    role: record.admin?.role ?? record.role ?? "BUSINESS_ADMIN",
  };
}
export function getDemoBusinessById(id: string) {
  return demoBusinesses.find((record) => record.id === id) ?? null;
}

export async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!hasSupabaseConnection()) {
    return null;
  }

  const response = await supabaseFetch(
    `/users?select=id,business_id,role,email,password_hash,password_plaintext,password_changed_at,deleted_at,active,created_at,updated_at&email=eq.${encodeURIComponent(
      normalizedEmail,
    )}&limit=1`,
  );

  if (response?.ok) {
    const rowsText = await response.text().catch(() => "");
    let rows: Array<Record<string, unknown>> = [];
    if (rowsText.trim()) {
      try {
        const parsed = JSON.parse(rowsText) as unknown;
        rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
      } catch {
        rows = [];
      }
    }
    return rows[0] ? fromSupabaseUser(rows[0]) : null;
  }

  return null;
}

export async function listBusinesses(): Promise<BusinessListRecord[]> {
  const config = getSupabaseConfig();

  if (config) {
    const [businessRows, adminRows] = await Promise.all([
      readRows(
        `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,plan_id,package_name,package_start,package_end,domain,hostname,verification_token,verified_at,activated_at,last_checked_at,ssl_status,domain_status,created_at,updated_at&order=created_at.desc`,
      ),
      readRows(
        `/users?select=id,business_id,role,email,password_hash,password_plaintext,password_changed_at,deleted_at,active,created_at,updated_at&role=eq.BUSINESS_ADMIN&deleted_at=is.null`,
      ),
    ]);

    const adminByBusinessId = new Map<string, Record<string, unknown>>();
    for (const row of adminRows) {
      const businessId = String(row.business_id ?? "");
      if (!businessId) {
        continue;
      }

      if (!adminByBusinessId.has(businessId)) {
        adminByBusinessId.set(businessId, row);
      }
    }

    return businessRows.map((row) => {
      const business = fromSupabaseBusiness(row);
      const admin = adminByBusinessId.get(business.id);
      const adminSummary = admin && !admin.deleted_at
        ? {
            id: String(admin.id ?? ""),
            email: String(admin.email ?? ""),
            password: String(admin.password_plaintext ?? "") || null,
            passwordChangedAt:
              (admin.password_changed_at as string | null) ?? null,
            role: (admin.role as SessionRole) ?? null,
            active: Boolean(admin.active ?? false),
          }
        : null;

      return {
        ...business,
        admin: adminSummary,
        adminId: adminSummary?.id ?? null,
        adminEmail: adminSummary?.email ?? "",
        adminPassword: adminSummary?.password ?? null,
        adminPasswordChangedAt: adminSummary?.passwordChangedAt ?? null,
        adminDeletedAt: null,
        adminRole: adminSummary?.role ?? null,
        adminActive: adminSummary?.active ?? null,
      } satisfies BusinessListRecord;
    });
  }

  return demoBusinesses.map((business) => {
    const admin = demoUsers.find(
      (user) => user.businessId === business.id && user.role === "BUSINESS_ADMIN",
    );
    const adminSummary =
      admin && !admin.deletedAt
        ? {
            id: admin.id,
            email: admin.email,
            password: admin.passwordPlaintext,
            passwordChangedAt: admin.passwordChangedAt,
            role: admin.role,
            active: admin.active,
          }
        : null;

    return {
      ...business,
      admin: adminSummary,
      adminId: adminSummary?.id ?? null,
      adminEmail: adminSummary?.email ?? "",
      adminPassword: adminSummary?.password ?? null,
      adminPasswordChangedAt: adminSummary?.passwordChangedAt ?? null,
      adminDeletedAt: null,
      adminRole: adminSummary?.role ?? null,
      adminActive: adminSummary?.active ?? null,
    } satisfies BusinessListRecord;
  });
}

export async function getBusinessById(id: string) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,plan_id,package_name,package_start,package_end,domain,hostname,verification_token,verified_at,activated_at,last_checked_at,ssl_status,domain_status,created_at,updated_at&id=eq.${encodeURIComponent(
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
    const fetchBusiness = async (field: "domain" | "hostname", value: string) => {
      const response = await supabaseFetch(
        `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,plan_id,package_name,package_start,package_end,domain,hostname,verification_token,verified_at,activated_at,last_checked_at,ssl_status,domain_status,created_at,updated_at&${field}=eq.${encodeURIComponent(
          value,
        )}&limit=1`,
      );

      if (!response?.ok) {
        return null;
      }

      const rows = (await response.json()) as Array<Record<string, unknown>>;
      return rows[0] ? fromSupabaseBusiness(rows[0]) : null;
    };

    const candidates = [normalizedDomain, `www.${normalizedDomain}`];
    for (const candidate of candidates) {
      const byDomain = await fetchBusiness("domain", candidate);
      if (byDomain) {
        return byDomain;
      }

      const byHostname = await fetchBusiness("hostname", candidate);
      if (byHostname) {
        return byHostname;
      }
    }
  }

  return (
    demoBusinesses.find(
      (business) =>
        business.domain?.toLowerCase() === normalizedDomain ||
        business.hostname?.toLowerCase() === normalizedDomain,
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
  const normalizedBusinessEmail = input.email.trim().toLowerCase();
  const normalizedAdminEmail = input.adminEmail.trim().toLowerCase();

  if (normalizedDomain && isReservedPlatformDomain(normalizedDomain)) {
    throw new Error("Platform domain business domain olarak kullanılamaz.");
  }

  if (config) {
    const result = await supabaseRpc("create_business_with_admin", {
      p_name: input.name,
      p_email: normalizedBusinessEmail,
      p_phone: input.phone || null,
      p_whatsapp: input.whatsapp || null,
      p_domain: normalizedDomain,
      p_admin_email: normalizedAdminEmail,
      p_admin_password_hash: adminPasswordHash,
    });

    if (!result.ok) {
      const rpcError = result.errorBody ?? "";

      if (/admin email already exists/i.test(rpcError)) {
        throw new Error("Bu admin emaili zaten kullanılıyor.");
      }

      if (/business domain already exists/i.test(rpcError)) {
        throw new Error("Bu domain zaten kullanılıyor.");
      }

      if (/business and admin email are required/i.test(rpcError)) {
        throw new Error("Business email ve admin email gerekli.");
      }

      if (/password hash is required/i.test(rpcError)) {
        throw new Error("Admin sifresi gerekli.");
      }

      throw new Error(
        rpcError || `Business olusturulamadi. HTTP ${result.status}.`,
      );
    }

    const data = parseCreateBusinessRpcResponse(result.data);

    if (!data?.businessId || !data.adminId) {
      console.error("create_business_with_admin RPC yaniti eksik", {
        rawBody: result.rawBody ?? result.errorBody ?? "",
      });
      throw new Error("Business olusturulamadi: RPC yaniti eksik.");
    }

    const business =
      (await getBusinessById(data.businessId)) ??
      ({
        id: data.businessId,
        name: data.businessName || input.name,
        email: data.businessEmail || normalizedBusinessEmail,
        phone: input.phone || null,
        whatsapp: input.whatsapp || null,
        logoUrl: null,
        active: true,
        planId: null,
        packageName: "Starter",
        packageStart: new Date().toISOString(),
        packageEnd: null,
        domain: normalizedDomain,
        hostname: normalizedDomain,
        verificationToken: normalizedDomain ? buildDomainVerificationToken() : null,
        verifiedAt: null,
        activatedAt: null,
        lastCheckedAt: normalizedDomain ? new Date().toISOString() : null,
        sslStatus: "pending",
        domainStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies BusinessRecord);

    return {
      business,
      admin: {
        id: data.adminId,
        businessId: business.id,
        role: (data.role as SessionRole) ?? "BUSINESS_ADMIN",
        email: data.adminEmail || normalizedAdminEmail,
        passwordPlaintext: input.adminPassword,
        passwordChangedAt: new Date().toISOString(),
        deletedAt: null,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } satisfies BusinessCreateResult;
  }
  const businessId = `business-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;
  const now = new Date().toISOString();

  if (
    demoBusinesses.some(
      (business) =>
        normalizedDomain &&
        business.domain?.toLowerCase() === normalizedDomain,
    )
  ) {
    throw new Error("Business domain zaten kullaniliyor.");
  }

  if (
    demoUsers.some(
      (user) =>
        user.email.toLowerCase() === normalizedAdminEmail &&
        user.role === "BUSINESS_ADMIN",
    )
  ) {
    throw new Error("Bu admin emaili zaten kullanılıyor.");
  }

  const business: BusinessRecord = {
    id: businessId,
    name: input.name,
    email: normalizedBusinessEmail,
    phone: input.phone || null,
    whatsapp: input.whatsapp || null,
    logoUrl: null,
    active: true,
    planId: null,
    packageName: "Starter",
    packageStart: now,
    packageEnd: null,
    domain: normalizedDomain,
    hostname: normalizedDomain,
    verificationToken: normalizedDomain ? buildDomainVerificationToken() : null,
    verifiedAt: null,
    activatedAt: null,
    lastCheckedAt: normalizedDomain ? now : null,
    sslStatus: "pending",
    domainStatus: normalizedDomain ? "pending" : "pending",
    createdAt: now,
    updatedAt: now,
  };

  const admin: UserRecord = {
    id: userId,
    businessId,
    role: "BUSINESS_ADMIN",
    email: normalizedAdminEmail,
    passwordHash: adminPasswordHash,
    passwordPlaintext: input.adminPassword,
    passwordChangedAt: now,
    deletedAt: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  demoBusinesses.unshift(business);
  demoUsers.push(admin);

  return {
    business,
    admin: {
      id: admin.id,
      businessId: admin.businessId,
      role: admin.role,
      email: admin.email,
      passwordPlaintext: admin.passwordPlaintext,
      passwordChangedAt: admin.passwordChangedAt,
      deletedAt: admin.deletedAt,
      active: admin.active,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    },
  } satisfies BusinessCreateResult;
}

export async function updateBusinessDomainRecord(
  businessId: string,
  input: BusinessDomainUpdateInput,
) {
  const config = getSupabaseConfig();
  const currentBusiness = await getBusinessById(businessId);
  const normalizedDomain = normalizeStoredDomain(input.domain ?? input.hostname);
  const nextHostname = normalizedDomain;
  const nextVerificationToken =
    input.verificationToken ?? currentBusiness?.verificationToken ?? null;
  const nextVerifiedAt = input.verifiedAt ?? currentBusiness?.verifiedAt ?? null;
  const nextActivatedAt = input.activatedAt ?? currentBusiness?.activatedAt ?? null;
  const nextLastCheckedAt = input.lastCheckedAt ?? currentBusiness?.lastCheckedAt ?? null;
  const nextSslStatus = (input.sslStatus ?? currentBusiness?.sslStatus ?? "pending") as DomainSslStatus;
  const nextDomainStatus = (input.domainStatus ?? currentBusiness?.domainStatus ?? "pending") as DomainStatus;
  const patchBody = {
    domain: normalizedDomain,
    hostname: nextHostname,
    verification_token: normalizedDomain ? nextVerificationToken ?? buildDomainVerificationToken() : null,
    verified_at: normalizedDomain ? nextVerifiedAt : null,
    activated_at: normalizedDomain ? nextActivatedAt : null,
    last_checked_at: normalizedDomain ? nextLastCheckedAt : null,
    ssl_status: normalizedDomain ? nextSslStatus : "pending",
    domain_status: normalizedDomain ? nextDomainStatus : "pending",
    updated_at: new Date().toISOString(),
  };

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
      const rowsText = await existing.text().catch(() => "");
      let rows: Array<Record<string, unknown>> = [];
      if (rowsText.trim()) {
        try {
          const parsed = JSON.parse(rowsText) as unknown;
          rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
        } catch {
          rows = [];
        }
      }
      if (rows[0] && String(rows[0].id ?? "") !== businessId) {
        throw new Error("Domain başka bir business tarafından kullanılıyor.");
      }
    }

    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(patchBody),
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
  existing.hostname = nextHostname;
  existing.verificationToken =
    normalizedDomain ? nextVerificationToken ?? buildDomainVerificationToken() : null;
  existing.verifiedAt = normalizedDomain ? nextVerifiedAt : null;
  existing.activatedAt = normalizedDomain ? nextActivatedAt : null;
  existing.lastCheckedAt = normalizedDomain ? nextLastCheckedAt : null;
  existing.sslStatus = normalizedDomain ? nextSslStatus : "pending";
  existing.domainStatus = normalizedDomain ? nextDomainStatus : "pending";
  existing.updatedAt = new Date().toISOString();

  return existing;
}

export async function updateBusinessOwnDomainRecord(
  businessId: string,
  domainInput: string,
) {
  const config = getSupabaseConfig();
  const normalizedDomain = normalizeStoredDomain(domainInput);
  const currentBusiness = await getBusinessById(businessId);

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
      const rowsText = await existing.text().catch(() => "");
      let rows: Array<Record<string, unknown>> = [];
      if (rowsText.trim()) {
        try {
          const parsed = JSON.parse(rowsText) as unknown;
          rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
        } catch {
          rows = [];
        }
      }
      if (rows[0] && String(rows[0].id ?? "") !== businessId) {
        throw new Error("Bu domain zaten kullanılıyor.");
      }
    }

    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          domain: normalizedDomain,
          hostname: normalizedDomain,
          verification_token: normalizedDomain
            ? currentBusiness?.verificationToken ?? buildDomainVerificationToken()
            : null,
          verified_at: null,
          activated_at: null,
          last_checked_at: normalizedDomain ? new Date().toISOString() : null,
          ssl_status: normalizedDomain ? "pending" : "pending",
          domain_status: "pending" as BusinessRecord["domainStatus"],
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Domain kaydedilemedi.");
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
    throw new Error("Bu domain zaten kullanılıyor.");
  }

  existing.domain = normalizedDomain;
  existing.hostname = normalizedDomain;
  existing.verificationToken = normalizedDomain
    ? currentBusiness?.verificationToken ?? buildDomainVerificationToken()
    : null;
  existing.verifiedAt = null;
  existing.activatedAt = null;
  existing.lastCheckedAt = normalizedDomain ? new Date().toISOString() : null;
  existing.sslStatus = "pending";
  existing.domainStatus = "pending";
  existing.updatedAt = new Date().toISOString();

  return existing;
}

export async function updateBusinessAdminPasswordRecord(
  businessId: string,
  userId: string,
  newPassword: string,
) {
  const nextPassword = newPassword.trim();

  if (!nextPassword) {
    throw new Error("Yeni sifre gerekli.");
  }

  const passwordHash = hashPassword(nextPassword);
  const changedAt = new Date().toISOString();
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/users?id=eq.${encodeURIComponent(userId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          password_hash: passwordHash,
          password_plaintext: nextPassword,
          password_changed_at: changedAt,
          updated_at: changedAt,
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Sifre guncellenemedi.");
    }

    return {
      passwordHash,
      passwordPlaintext: nextPassword,
      passwordChangedAt: changedAt,
    };
  }

  const existing = demoUsers.find(
    (user) => user.id === userId && user.businessId === businessId,
  );

  if (!existing) {
    throw new Error("Kullanici bulunamadi.");
  }

  existing.passwordHash = passwordHash;
  existing.passwordPlaintext = nextPassword;
  existing.passwordChangedAt = changedAt;
  existing.updatedAt = changedAt;

  return {
    passwordHash,
    passwordPlaintext: nextPassword,
    passwordChangedAt: changedAt,
  };
}

export async function updateBusinessActiveRecord(
  businessId: string,
  active: boolean,
) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          active,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Business durumu guncellenemedi.");
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

  existing.active = active;
  existing.updatedAt = new Date().toISOString();
  return existing;
}

export async function deleteBusinessRecord(businessId: string) {
  const config = getSupabaseConfig();

  if (config) {
    const existing = await getBusinessById(businessId);

    if (!existing) {
      throw new Error("Business bulunamadi.");
    }

    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Business silinemedi.");
    }

    return true;
  }

  const index = demoBusinesses.findIndex((business) => business.id === businessId);

  if (index < 0) {
    throw new Error("Business bulunamadi.");
  }

  demoBusinesses.splice(index, 1);

  for (let i = demoUsers.length - 1; i >= 0; i -= 1) {
    if (demoUsers[i]?.businessId === businessId) {
      demoUsers.splice(i, 1);
    }
  }

  return true;
}

export async function updateBusinessAdminActiveRecord(
  businessId: string,
  active: boolean,
) {
  const changedAt = new Date().toISOString();
  const config = getSupabaseConfig();

  if (config) {
    const admins = await readRows(
      `/users?select=id,business_id,role,email,password_hash,password_plaintext,password_changed_at,deleted_at,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&role=eq.BUSINESS_ADMIN&deleted_at=is.null&limit=1`,
    );
    const admin = admins[0];

    if (!admin?.id) {
      throw new Error("Business admin bulunamadi.");
    }

    const response = await supabaseFetch(
      `/users?id=eq.${encodeURIComponent(String(admin.id))}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          active,
          updated_at: changedAt,
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Business admin durumu guncellenemedi.");
    }

    return true;
  }

  const admin = demoUsers.find(
    (user) =>
      user.businessId === businessId &&
      user.role === "BUSINESS_ADMIN" &&
      !user.deletedAt,
  );

  if (!admin) {
    throw new Error("Business admin bulunamadi.");
  }

  admin.active = active;
  admin.updatedAt = changedAt;
  return true;
}

export async function deleteBusinessAdminRecord(businessId: string) {
  const config = getSupabaseConfig();

  if (config) {
    const admins = await readRows(
      `/users?select=id,business_id,role,email,password_hash,password_plaintext,password_changed_at,deleted_at,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&role=eq.BUSINESS_ADMIN&limit=1`,
    );
    const admin = admins[0];

    if (!admin?.id) {
      throw new Error("Business admin bulunamadi.");
    }

    const response = await supabaseFetch(
      `/users?id=eq.${encodeURIComponent(String(admin.id))}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Business admin silinemedi.");
    }

    return true;
  }

  const admin = demoUsers.find(
    (user) =>
      user.businessId === businessId &&
      user.role === "BUSINESS_ADMIN" &&
      !user.deletedAt,
  );

  if (!admin) {
    throw new Error("Business admin bulunamadi.");
  }

  const index = demoUsers.findIndex((user) => user.id === admin.id);
  if (index >= 0) {
    demoUsers.splice(index, 1);
  }
  return true;
}

export async function createBusinessAdminRecord(
  businessId: string,
  email: string,
  password: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const nextPassword = password.trim();

  if (!normalizedEmail || !nextPassword) {
    throw new Error("Admin email ve sifre gerekli.");
  }

  const passwordHash = hashPassword(nextPassword);
  const changedAt = new Date().toISOString();
  const config = getSupabaseConfig();

  if (config) {
    const existing = await readRows(
      `/users?select=id,deleted_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&role=eq.BUSINESS_ADMIN&deleted_at=is.null&limit=1`,
    );

    if (existing[0]) {
      throw new Error("Bu business icin aktif admin zaten var.");
    }

    const response = await supabaseFetch(`/users`, {
      method: "POST",
      body: JSON.stringify({
        business_id: businessId,
        role: "BUSINESS_ADMIN",
        email: normalizedEmail,
        password_hash: passwordHash,
        password_plaintext: nextPassword,
        password_changed_at: changedAt,
        deleted_at: null,
        active: true,
      }),
    });

    if (!response?.ok) {
      throw new Error("Business admin olusturulamadi.");
    }

    return true;
  }

  const existing = demoUsers.find(
    (user) =>
      user.businessId === businessId &&
      user.role === "BUSINESS_ADMIN" &&
      !user.deletedAt,
  );

  if (existing) {
    throw new Error("Bu business icin aktif admin zaten var.");
  }

  demoUsers.push({
    id: `user-${randomUUID()}`,
    businessId,
    role: "BUSINESS_ADMIN",
    email: normalizedEmail,
    passwordHash,
    passwordPlaintext: nextPassword,
    passwordChangedAt: changedAt,
    deletedAt: null,
    active: true,
    createdAt: changedAt,
    updatedAt: changedAt,
  });

  return true;
}

export type BusinessUpdateInput = {
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  logoUrl: string;
};

export type BusinessSubscriptionUpdateInput = {
  planId: string | null;
  packageName: string | null;
  packageStart: string | null;
  packageEnd: string | null;
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

  existing.name = input.name.trim();
  existing.email = input.email.trim();
  existing.phone = input.phone.trim() || null;
  existing.whatsapp = input.whatsapp.trim() || null;
  existing.logoUrl = input.logoUrl.trim() || null;
  existing.updatedAt = new Date().toISOString();

  return existing;
}

export async function updateBusinessSubscriptionRecord(
  businessId: string,
  input: BusinessSubscriptionUpdateInput,
) {
  const config = getSupabaseConfig();

  if (config) {
    const response = await supabaseFetch(
      `/businesses?id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          plan_id: input.planId,
          package_name: input.packageName,
          package_start: input.packageStart,
          package_end: input.packageEnd,
          updated_at: new Date().toISOString(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Abonelik guncellenemedi.");
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

  existing.planId = input.planId;
  existing.packageName = input.packageName;
  existing.packageStart = input.packageStart;
  existing.packageEnd = input.packageEnd;
  existing.updatedAt = new Date().toISOString();

  return existing;
}

