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
  type DomainAutomationMode,
  type DomainSslStatus,
  type DomainProviderStatus,
  type DomainStatus,
} from "@/lib/domain-utils";
import {
  createSupabaseAuthUser,
  deleteSupabaseAuthUser,
  getSupabaseAuthUserById,
  signInWithSupabaseAuth,
  updateSupabaseAuthUserPassword,
} from "@/lib/supabase-auth";
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
  domainProvider: DomainAutomationMode;
  domainProviderStatus: DomainProviderStatus;
  domainProviderMessage: string | null;
  domainProviderSyncedAt: string | null;
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
  authUserId: string | null;
  passwordHash: string;
  passwordPlaintext: string | null;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  deletedAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BusinessListRecord = BusinessRecord & {
  admin: {
    id: string;
    email: string;
    authUserId: string | null;
    password: string | null;
    passwordChangedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string | null;
    role: SessionRole | null;
    active: boolean | null;
  } | null;
  adminId: string | null;
  adminEmail: string;
  adminPassword: string | null;
  adminPasswordChangedAt: string | null;
  adminLastLoginAt: string | null;
  adminCreatedAt: string | null;
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
  domainProvider?: BusinessRecord["domainProvider"];
  domainProviderStatus?: BusinessRecord["domainProviderStatus"];
  domainProviderMessage?: string | null;
  domainProviderSyncedAt?: string | null;
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
    domainProvider: "manual",
    domainProviderStatus: "manual",
    domainProviderMessage: null,
    domainProviderSyncedAt: null,
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
      authUserId: null,
      passwordHash: hashPassword(superAdminPassword),
      passwordPlaintext: superAdminPassword,
      passwordChangedAt: "2026-06-01T00:00:00.000Z",
      lastLoginAt: null,
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
      authUserId: null,
      passwordHash: hashPassword(businessAdminPassword),
      passwordPlaintext: businessAdminPassword,
      passwordChangedAt: "2026-06-01T00:00:00.000Z",
      lastLoginAt: null,
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
    domainProvider: ((row.domain_provider as DomainAutomationMode) ?? "manual"),
    domainProviderStatus: ((row.provider_status as DomainProviderStatus) ?? "manual"),
    domainProviderMessage: (row.provider_message as string | null) ?? null,
    domainProviderSyncedAt: (row.provider_synced_at as string | null) ?? null,
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
    authUserId: (row.auth_user_id as string | null) ?? null,
    passwordHash: String(row.password_hash ?? ""),
    passwordPlaintext: (row.password_plaintext as string | null) ?? null,
    passwordChangedAt: (row.password_changed_at as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
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

async function readResponseRows(response: Response | null) {
  if (!response) {
    return [] as Array<Record<string, unknown>>;
  }

  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [];
  }
}

async function readBusinessAdminRowByBusinessId(businessId: string) {
  const rows = await readRows(
    `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
      businessId,
    )}&role=eq.BUSINESS_ADMIN&deleted_at=is.null&limit=1`,
  );

  return rows[0] ?? null;
}

async function readUserRowByAuthUserId(authUserId: string) {
  const rows = await readRows(
    `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&auth_user_id=eq.${encodeURIComponent(
      authUserId,
    )}&limit=1`,
  );

  return rows[0] ?? null;
}

async function readUserRowByEmail(email: string) {
  const rows = await readRows(
    `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&email=eq.${encodeURIComponent(
      email,
    )}&limit=1`,
  );

  return rows[0] ?? null;
}

async function insertBusinessRow(input: {
  name: string;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  domain: string | null;
}) {
  const response = await supabaseFetch("/businesses", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: input.name,
        email: input.email,
      phone: input.phone,
      whatsapp: input.whatsapp,
      domain: input.domain,
      domain_status: "pending",
      ssl_status: "pending",
      domain_provider: "manual",
      provider_status: "manual",
    }),
  });

  if (!response?.ok) {
    const text = response ? await response.text().catch(() => "") : "";
    throw new Error(text || "Business olusturulamadi.");
  }

  const rows = await readResponseRows(response);
  const row = rows[0];

  if (!row?.id) {
    throw new Error("Business olusturulamadi: yanit eksik.");
  }

  return fromSupabaseBusiness(row);
}

async function deleteBusinessRow(businessId: string) {
  const response = await supabaseFetch(
    `/businesses?id=eq.${encodeURIComponent(businessId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response?.ok) {
    return false;
  }

  return true;
}

async function upsertUserRowById(
  user: Partial<UserRecord> & {
    id?: string;
    authUserId?: string | null;
    email: string;
    businessId: string | null;
    role: SessionRole;
  },
) {
  const now = new Date().toISOString();
  const existingByAuth = user.authUserId
    ? await readUserRowByAuthUserId(user.authUserId)
    : null;
  const existingByEmail = existingByAuth ? null : await readUserRowByEmail(user.email);
  const existing = existingByAuth ?? existingByEmail;
  const payload = {
    id: existing?.id ?? user.id ?? randomUUID(),
    business_id: user.businessId,
    role: user.role,
    email: user.email,
    auth_user_id: user.authUserId ?? existing?.auth_user_id ?? null,
    password_hash: user.passwordHash ?? existing?.password_hash ?? "",
    password_plaintext: user.passwordPlaintext ?? existing?.password_plaintext ?? null,
    password_changed_at: user.passwordChangedAt ?? existing?.password_changed_at ?? null,
    last_login_at: user.lastLoginAt ?? existing?.last_login_at ?? null,
    deleted_at: user.deletedAt ?? existing?.deleted_at ?? null,
    active: user.active ?? existing?.active ?? true,
    created_at: existing?.created_at ?? now,
    updated_at: user.updatedAt ?? now,
  };

  const response = existing
    ? await supabaseFetch(`/users?id=eq.${encodeURIComponent(String(existing.id ?? payload.id))}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
    : await supabaseFetch("/users", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        ...payload,
        active: payload.active ?? true,
        deleted_at: payload.deleted_at ?? null,
      }),
      });

  if (!response?.ok) {
    const text = response ? await response.text().catch(() => "") : "";
    throw new Error(text || "Kullanici kaydedilemedi.");
  }

  const rows = existing ? [payload] : await readResponseRows(response);
  const row = rows[0] ?? payload;

  return fromSupabaseUser({
    id: row.id,
    business_id: row.business_id,
    role: row.role,
    email: row.email,
    auth_user_id: row.auth_user_id,
    password_hash: row.password_hash,
    password_plaintext: row.password_plaintext,
    password_changed_at: row.password_changed_at,
    last_login_at: row.last_login_at,
    deleted_at: row.deleted_at,
    active: row.active,
    created_at: row.created_at ?? now,
    updated_at: row.updated_at ?? now,
  });
}

async function deleteUserRow(userId: string) {
  const response = await supabaseFetch(`/users?id=eq.${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });

  return Boolean(response?.ok);
}

export async function repairBusinessAdminAuthUser(user: UserRecord) {
  if (user.role !== "BUSINESS_ADMIN") {
    return user;
  }

  const existingAuthId = user.authUserId?.trim() || null;
  if (existingAuthId) {
    const authLookup = await getSupabaseAuthUserById(existingAuthId);
    if (authLookup.ok && authLookup.user?.id) {
      return user;
    }
  }

  if (!user.passwordPlaintext) {
    throw new Error("Business admin sifresi bulunamadi; auth kullanici onarilamadi.");
  }

  const createResult = await createSupabaseAuthUser({
    email: user.email,
    password: user.passwordPlaintext,
    emailConfirm: true,
    appMetadata: {
      role: user.role,
      businessId: user.businessId,
    },
    userMetadata: {
      role: user.role,
      businessId: user.businessId,
    },
  });

  let authUser = createResult.user;

  if (!authUser && createResult.duplicateEmail) {
    const loginResult = await signInWithSupabaseAuth(user.email, user.passwordPlaintext);

    if (!loginResult.user) {
      throw new Error(loginResult.errorMessage ?? "Auth kullanici onarilamadi.");
    }

    authUser = loginResult.user;
  }

  if (!authUser?.id) {
    throw new Error(createResult.errorMessage ?? "Auth kullanici onarilamadi.");
  }

  const repaired = await upsertUserRowById({
    id: user.id,
    businessId: user.businessId,
    role: user.role,
    email: user.email,
    authUserId: authUser.id,
    passwordHash: user.passwordHash,
    passwordPlaintext: user.passwordPlaintext,
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    deletedAt: user.deletedAt,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: new Date().toISOString(),
  });

  return repaired;
}

export async function ensureBusinessAdminAuthUser(user: UserRecord) {
  if (user.role !== "BUSINESS_ADMIN") {
    return user;
  }

  const current = user.authUserId ? await readUserRowByAuthUserId(user.authUserId) : null;

  if (current?.id && user.authUserId) {
    const authLookup = await getSupabaseAuthUserById(user.authUserId);
    if (authLookup.ok && authLookup.user?.id) {
      return fromSupabaseUser(current);
    }
  }

  if (current?.id && !user.authUserId) {
    return fromSupabaseUser(current);
  }

  return repairBusinessAdminAuthUser(user);
}

export async function syncBusinessAdminFromAuthLogin(
  authUser: {
    id: string;
    email: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  },
  password: string,
) {
  const normalizedEmail = authUser.email.trim().toLowerCase();
  const now = new Date().toISOString();
  const businessId =
    (typeof authUser.user_metadata?.businessId === "string"
      ? authUser.user_metadata.businessId
      : null) ??
    (typeof authUser.app_metadata?.businessId === "string"
      ? authUser.app_metadata.businessId
      : null);

  const existing =
    (await readUserRowByAuthUserId(authUser.id)) ??
    (await readUserRowByEmail(normalizedEmail));
  const resolvedBusinessId =
    String(existing?.business_id ?? businessId ?? "").trim() || null;

  if (!resolvedBusinessId) {
    throw new Error("Business admin public kaydi icin businessId bulunamadi.");
  }

  const upserted = await upsertUserRowById({
    id: existing?.id ? String(existing.id) : undefined,
    businessId: resolvedBusinessId,
    role: (existing?.role as SessionRole) ?? "BUSINESS_ADMIN",
    email: normalizedEmail,
    authUserId: authUser.id,
    passwordHash: String(existing?.password_hash ?? hashPassword(password)),
    passwordPlaintext: (existing?.password_plaintext as string | null) ?? password,
    passwordChangedAt:
      (existing?.password_changed_at as string | null) ?? now,
    lastLoginAt: now,
    deletedAt: null,
    active: Boolean(existing?.active ?? true),
  });

  return upserted;
}

export async function repairMissingBusinessAdminAuthRecords() {
  const config = getSupabaseConfig();

  if (!config) {
    return { repaired: 0, skipped: 0, failed: 0 };
  }

  const rows = await readRows(
    `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&role=eq.BUSINESS_ADMIN&deleted_at=is.null`,
  );

  let repaired = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const user = fromSupabaseUser(row);

    try {
      const beforeAuthId = user.authUserId;
      await ensureBusinessAdminAuthUser(user);
      if (beforeAuthId) {
        skipped += 1;
      } else {
        repaired += 1;
      }
    } catch (error) {
      failed += 1;
      console.warn("repairMissingBusinessAdminAuthRecords failed", {
        userId: user.id,
        businessId: user.businessId,
        email: user.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { repaired, skipped, failed };
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
    `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&email=eq.${encodeURIComponent(
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
      `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,plan_id,package_name,package_start,package_end,domain,hostname,verification_token,verified_at,activated_at,last_checked_at,domain_provider,provider_status,provider_message,provider_synced_at,ssl_status,domain_status,created_at,updated_at&order=created_at.desc`,
      ),
      readRows(
        `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&role=eq.BUSINESS_ADMIN&deleted_at=is.null`,
      ),
    ]);

    await Promise.allSettled(
      adminRows.map(async (row) => {
        try {
          await ensureBusinessAdminAuthUser(fromSupabaseUser(row));
        } catch (error) {
          console.warn("Business admin auth repair skipped", {
            businessId: String(row.business_id ?? ""),
            email: String(row.email ?? ""),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
    );

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
            authUserId: (admin.auth_user_id as string | null) ?? null,
            password: String(admin.password_plaintext ?? "") || null,
            passwordChangedAt:
              (admin.password_changed_at as string | null) ?? null,
            lastLoginAt: (admin.last_login_at as string | null) ?? null,
            createdAt: (admin.created_at as string | null) ?? null,
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
        adminLastLoginAt: adminSummary?.lastLoginAt ?? null,
        adminCreatedAt: adminSummary?.createdAt ?? null,
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
            authUserId: admin.authUserId,
            password: admin.passwordPlaintext,
            passwordChangedAt: admin.passwordChangedAt,
            lastLoginAt: admin.lastLoginAt,
            createdAt: admin.createdAt,
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
      adminLastLoginAt: adminSummary?.lastLoginAt ?? null,
      adminCreatedAt: adminSummary?.createdAt ?? null,
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
      `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,plan_id,package_name,package_start,package_end,domain,hostname,verification_token,verified_at,activated_at,last_checked_at,domain_provider,provider_status,provider_message,provider_synced_at,ssl_status,domain_status,created_at,updated_at&id=eq.${encodeURIComponent(
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
        `/businesses?select=id,name,email,phone,whatsapp,logo_url,active,plan_id,package_name,package_start,package_end,domain,hostname,verification_token,verified_at,activated_at,last_checked_at,domain_provider,provider_status,provider_message,provider_synced_at,ssl_status,domain_status,created_at,updated_at&${field}=eq.${encodeURIComponent(
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
  const now = new Date().toISOString();

  if (normalizedDomain && isReservedPlatformDomain(normalizedDomain)) {
    throw new Error("Platform domain business domain olarak kullanılamaz.");
  }

  if (config) {
    const createdBusiness = await insertBusinessRow({
      name: input.name,
      email: normalizedBusinessEmail,
      phone: input.phone || null,
      whatsapp: input.whatsapp || null,
      domain: normalizedDomain,
    });

    let authUserId: string | null = null;
    let createdAuthUser = false;

    try {
      const authResult = await createSupabaseAuthUser({
        email: normalizedAdminEmail,
        password: input.adminPassword,
        emailConfirm: true,
        appMetadata: {
          role: "BUSINESS_ADMIN",
          businessId: createdBusiness.id,
        },
        userMetadata: {
          role: "BUSINESS_ADMIN",
          businessId: createdBusiness.id,
          businessName: input.name,
        },
      });

      authUserId = authResult.user?.id ?? null;
      createdAuthUser = Boolean(authUserId && !authResult.duplicateEmail);

      if (!authUserId && authResult.duplicateEmail) {
        const loginResult = await signInWithSupabaseAuth(
          normalizedAdminEmail,
          input.adminPassword,
        );
        authUserId = loginResult.user?.id ?? null;
      }

      if (!authUserId) {
        throw new Error(authResult.errorMessage ?? "Auth kullanici olusturulamadi.");
      }

      const admin = await upsertUserRowById({
        businessId: createdBusiness.id,
        role: "BUSINESS_ADMIN",
        email: normalizedAdminEmail,
        authUserId,
        passwordHash: adminPasswordHash,
        passwordPlaintext: input.adminPassword,
        passwordChangedAt: now,
        lastLoginAt: null,
        deletedAt: null,
        active: true,
      });

      return {
        business: createdBusiness,
        admin: {
          id: admin.id,
          businessId: admin.businessId,
          role: admin.role,
          email: admin.email,
          authUserId: admin.authUserId,
          passwordPlaintext: admin.passwordPlaintext,
          passwordChangedAt: admin.passwordChangedAt,
          lastLoginAt: admin.lastLoginAt,
          deletedAt: admin.deletedAt,
          active: admin.active,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      } satisfies BusinessCreateResult;
    } catch (error) {
      if (authUserId && createdAuthUser) {
        await deleteSupabaseAuthUser(authUserId).catch(() => null);
      }
      await deleteBusinessRow(createdBusiness.id).catch(() => null);
      throw error;
    }
  }
  const businessId = `business-${randomUUID()}`;
  const userId = `user-${randomUUID()}`;

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
    domainProvider: "manual",
    domainProviderStatus: "manual",
    domainProviderMessage: null,
    domainProviderSyncedAt: null,
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
    authUserId: null,
    passwordHash: adminPasswordHash,
    passwordPlaintext: input.adminPassword,
    passwordChangedAt: now,
    lastLoginAt: null,
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
      authUserId: admin.authUserId,
      passwordPlaintext: admin.passwordPlaintext,
      passwordChangedAt: admin.passwordChangedAt,
      lastLoginAt: admin.lastLoginAt,
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
  const nextDomainProvider = input.domainProvider ?? currentBusiness?.domainProvider ?? "manual";
  const nextDomainProviderStatus =
    input.domainProviderStatus ?? currentBusiness?.domainProviderStatus ?? "manual";
  const nextDomainProviderMessage =
    input.domainProviderMessage ?? currentBusiness?.domainProviderMessage ?? null;
  const nextDomainProviderSyncedAt =
    input.domainProviderSyncedAt ?? currentBusiness?.domainProviderSyncedAt ?? null;
  const patchBody = {
    domain: normalizedDomain,
    hostname: nextHostname,
    verification_token: normalizedDomain ? nextVerificationToken ?? buildDomainVerificationToken() : null,
    verified_at: normalizedDomain ? nextVerifiedAt : null,
    activated_at: normalizedDomain ? nextActivatedAt : null,
    last_checked_at: normalizedDomain ? nextLastCheckedAt : null,
    domain_provider: normalizedDomain ? nextDomainProvider : "manual",
    provider_status: normalizedDomain ? nextDomainProviderStatus : "manual",
    provider_message: normalizedDomain ? nextDomainProviderMessage : null,
    provider_synced_at: normalizedDomain ? nextDomainProviderSyncedAt : null,
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
  existing.domainProvider = normalizedDomain ? nextDomainProvider : "manual";
  existing.domainProviderStatus = normalizedDomain ? nextDomainProviderStatus : "manual";
  existing.domainProviderMessage = normalizedDomain ? nextDomainProviderMessage : null;
  existing.domainProviderSyncedAt = normalizedDomain ? nextDomainProviderSyncedAt : null;
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
          domain_provider: normalizedDomain ? currentBusiness?.domainProvider ?? "manual" : "manual",
          provider_status: normalizedDomain ? currentBusiness?.domainProviderStatus ?? "manual" : "manual",
          provider_message: normalizedDomain ? currentBusiness?.domainProviderMessage ?? null : null,
          provider_synced_at: normalizedDomain ? currentBusiness?.domainProviderSyncedAt ?? null : null,
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
  existing.domainProvider = normalizedDomain ? currentBusiness?.domainProvider ?? "manual" : "manual";
  existing.domainProviderStatus = normalizedDomain ? currentBusiness?.domainProviderStatus ?? "manual" : "manual";
  existing.domainProviderMessage = normalizedDomain ? currentBusiness?.domainProviderMessage ?? null : null;
  existing.domainProviderSyncedAt = normalizedDomain ? currentBusiness?.domainProviderSyncedAt ?? null : null;
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
    const admins = await readRows(
      `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&id=eq.${encodeURIComponent(
        userId,
      )}&business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
    );
    const adminRow = admins[0];
    if (!adminRow?.id) {
      throw new Error("Business admin bulunamadi.");
    }

    const authUserId = String(adminRow.auth_user_id ?? "");
    if (!authUserId) {
      const repaired = await ensureBusinessAdminAuthUser(fromSupabaseUser(adminRow));
      if (repaired.authUserId) {
        await updateSupabaseAuthUserPassword(repaired.authUserId, nextPassword).catch(() => null);
      }
    } else {
      const authLookup = await getSupabaseAuthUserById(authUserId);
      if (!authLookup.ok || !authLookup.user?.id) {
        const repaired = await ensureBusinessAdminAuthUser(fromSupabaseUser(adminRow));
        if (repaired.authUserId) {
          await updateSupabaseAuthUserPassword(repaired.authUserId, nextPassword).catch(() => null);
        }
      } else {
        await updateSupabaseAuthUserPassword(authUserId, nextPassword).catch(() => null);
      }
    }

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
    const admins = await readRows(
      `/users?select=id,auth_user_id&business_id=eq.${encodeURIComponent(
        businessId,
      )}&role=eq.BUSINESS_ADMIN&deleted_at=is.null`,
    );

    for (const admin of admins) {
      const authUserId = String(admin.auth_user_id ?? "");
      if (authUserId) {
        await deleteSupabaseAuthUser(authUserId).catch(() => null);
      }
    }

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
      `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
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
      `/users?select=id,business_id,role,email,auth_user_id,password_hash,password_plaintext,password_changed_at,last_login_at,deleted_at,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&role=eq.BUSINESS_ADMIN&limit=1`,
    );
    const admin = admins[0];

    if (!admin?.id) {
      throw new Error("Business admin bulunamadi.");
    }

    if (admin.auth_user_id) {
      await deleteSupabaseAuthUser(String(admin.auth_user_id)).catch(() => null);
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
    const currentBusiness = await getBusinessById(businessId);
    if (!currentBusiness) {
      throw new Error("Business bulunamadi.");
    }

    const existingAdmin = await readBusinessAdminRowByBusinessId(businessId);
    if (existingAdmin && existingAdmin.deleted_at) {
      await deleteUserRow(String(existingAdmin.id)).catch(() => null);
    }

    if (existingAdmin && !existingAdmin.deleted_at) {
      const repaired = await ensureBusinessAdminAuthUser(fromSupabaseUser(existingAdmin));
      const updated = await upsertUserRowById({
        id: repaired.id,
        businessId,
        role: "BUSINESS_ADMIN",
        email: normalizedEmail,
        authUserId: repaired.authUserId,
        passwordHash: repaired.passwordHash,
        passwordPlaintext: nextPassword,
        passwordChangedAt: changedAt,
        lastLoginAt: repaired.lastLoginAt,
        deletedAt: null,
        active: true,
      });

      const nextAuthUserId = updated.authUserId ?? repaired.authUserId;
      if (nextAuthUserId) {
        await updateSupabaseAuthUserPassword(nextAuthUserId, nextPassword).catch(() => null);
      }

      return true;
    }

    const authResult = await createSupabaseAuthUser({
      email: normalizedEmail,
      password: nextPassword,
      emailConfirm: true,
      appMetadata: {
        role: "BUSINESS_ADMIN",
        businessId,
      },
      userMetadata: {
        role: "BUSINESS_ADMIN",
        businessId,
        businessName: currentBusiness.name,
      },
    });

    let authUserId = authResult.user?.id ?? null;
    const createdAuthUser = Boolean(authUserId && !authResult.duplicateEmail);
    if (!authUserId && authResult.duplicateEmail) {
      const loginResult = await signInWithSupabaseAuth(normalizedEmail, nextPassword);
      authUserId = loginResult.user?.id ?? null;
    }

    if (!authUserId) {
      throw new Error(authResult.errorMessage ?? "Business admin olusturulamadi.");
    }

    try {
      await upsertUserRowById({
        businessId,
        role: "BUSINESS_ADMIN",
        email: normalizedEmail,
        authUserId,
        passwordHash,
        passwordPlaintext: nextPassword,
        passwordChangedAt: changedAt,
        lastLoginAt: null,
        deletedAt: null,
        active: true,
      });
      return true;
    } catch (error) {
      if (createdAuthUser && authUserId) {
        await deleteSupabaseAuthUser(authUserId).catch(() => null);
      }
      throw error;
    }
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
    authUserId: null,
    passwordHash,
    passwordPlaintext: nextPassword,
    passwordChangedAt: changedAt,
    lastLoginAt: null,
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

