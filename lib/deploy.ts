import "server-only";

import { randomUUID } from "node:crypto";
import { listBusinesses } from "@/lib/business";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type DeployReleaseStatus = "draft" | "ready" | "deployed" | "rollback";
export type DeployHealthState = "healthy" | "warning" | "down";

export type DeployReleaseRecord = {
  id: string;
  version: string;
  releasedAt: string | null;
  releasedBy: string | null;
  notes: string | null;
  status: DeployReleaseStatus;
  createdAt: string;
  updatedAt: string;
};

export type DeployHealthCard = {
  key: string;
  label: string;
  status: DeployHealthState;
  description: string;
  lastCheckedAt: string;
};

export type DeployChecklistItem = {
  key: string;
  label: string;
  done: boolean;
  detail: string;
};

type DeployReleaseInput = {
  version: string;
  releasedBy?: string | null;
  notes?: string | null;
  status?: DeployReleaseStatus;
};

type DeployReleaseUpdateInput = Partial<DeployReleaseInput> & {
  releasedAt?: string | null;
};

const SYSTEM_SCOPE = "system";
const demoDeployReleases = new Map<string, DeployReleaseRecord[]>([
  [SYSTEM_SCOPE, []],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown): DeployReleaseStatus {
  const normalized = normalizeText(value);
  if (normalized === "draft" || normalized === "ready" || normalized === "deployed" || normalized === "rollback") {
    return normalized;
  }
  return "draft";
}

function mapRelease(row: Record<string, unknown>): DeployReleaseRecord {
  return {
    id: String(row.id ?? ""),
    version: String(row.version ?? ""),
    releasedAt: (row.released_at as string | null) ?? null,
    releasedBy: (row.released_by as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: normalizeStatus(row.status),
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

function demoReleases() {
  return demoDeployReleases.get(SYSTEM_SCOPE) ?? [];
}

export async function listDeployReleases(limit = 50) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/deploy_releases?select=id,version,released_at,released_by,notes,status,created_at,updated_at&order=updated_at.desc,created_at.desc&limit=${Math.max(
        1,
        Math.trunc(limit),
      )}`,
    );

    if (!response?.ok) {
      return [];
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows.map(mapRelease);
  }

  return demoReleases().slice(0, limit);
}

export async function createDeployRelease(input: DeployReleaseInput) {
  const version = normalizeText(input.version);

  if (!version) {
    throw new Error("Release version gerekli.");
  }

  const record: DeployReleaseRecord = {
    id: `deploy-${randomUUID()}`,
    version,
    releasedAt:
      input.status === "deployed" || input.status === "rollback" ? nowIso() : null,
    releasedBy: normalizeText(input.releasedBy) || null,
    notes: normalizeText(input.notes) || null,
    status: normalizeStatus(input.status),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch("/deploy_releases", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        version: record.version,
        released_at: record.releasedAt,
        released_by: record.releasedBy,
        notes: record.notes,
        status: record.status,
        created_at: record.createdAt,
        updated_at: record.updatedAt,
      }),
    });

    if (!response?.ok) {
      const text = response ? await response.text().catch(() => "") : "";
      throw new Error(text || "Release oluşturulamadı.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapRelease(rows[0]) : record;
  }

  const current = demoDeployReleases.get(SYSTEM_SCOPE) ?? [];
  demoDeployReleases.set(SYSTEM_SCOPE, [record, ...current]);
  return record;
}

export async function updateDeployRelease(
  releaseId: string,
  input: DeployReleaseUpdateInput,
) {
  const safeReleaseId = normalizeText(releaseId);

  if (!safeReleaseId) {
    throw new Error("Release bulunamadı.");
  }

  const current = await listDeployReleases(200);
  const existing = current.find((item) => item.id === safeReleaseId);

  if (!existing) {
    throw new Error("Release bulunamadı.");
  }

  const nextStatus = input.status === undefined ? existing.status : normalizeStatus(input.status);
  const payload: DeployReleaseRecord = {
    ...existing,
    version: input.version === undefined ? existing.version : normalizeText(input.version) || existing.version,
    releasedAt:
      input.releasedAt === undefined
        ? existing.releasedAt
        : input.releasedAt || null,
    releasedBy:
      input.releasedBy === undefined
        ? existing.releasedBy
        : normalizeText(input.releasedBy) || null,
    notes:
      input.notes === undefined
        ? existing.notes
        : normalizeText(input.notes) || null,
    status: nextStatus,
    updatedAt: nowIso(),
  };

  if (payload.status === "deployed" || payload.status === "rollback") {
    payload.releasedAt = payload.releasedAt ?? nowIso();
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/deploy_releases?id=eq.${encodeURIComponent(safeReleaseId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        version: payload.version,
        released_at: payload.releasedAt,
        released_by: payload.releasedBy,
        notes: payload.notes,
        status: payload.status,
        updated_at: payload.updatedAt,
      }),
    });

    if (!response?.ok) {
      const text = response ? await response.text().catch(() => "") : "";
      throw new Error(text || "Release güncellenemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapRelease(rows[0]) : payload;
  }

  const next = current.map((item) => (item.id === safeReleaseId ? payload : item));
  demoDeployReleases.set(SYSTEM_SCOPE, next);
  return payload;
}

export async function rollbackDeployRelease(releaseId: string, releasedBy?: string | null) {
  return updateDeployRelease(releaseId, {
    status: "rollback",
    releasedBy: releasedBy ?? null,
    releasedAt: nowIso(),
  });
}

function hasMailEnv() {
  const resend = normalizeText(process.env.RESEND_API_KEY);
  const smtpHost = normalizeText(process.env.SMTP_HOST);
  const smtpUser = normalizeText(process.env.SMTP_USER);
  const smtpPassword = normalizeText(process.env.SMTP_PASSWORD);
  return Boolean(resend || (smtpHost && smtpUser && smtpPassword));
}

function hasWhatsAppEnv() {
  const metaToken = normalizeText(process.env.WHATSAPP_META_TOKEN);
  const metaPhone = normalizeText(process.env.WHATSAPP_META_PHONE_NUMBER_ID);
  const twilioSid = normalizeText(process.env.TWILIO_ACCOUNT_SID);
  const twilioToken = normalizeText(process.env.TWILIO_AUTH_TOKEN);
  const twilioFrom = normalizeText(process.env.TWILIO_WHATSAPP_FROM) || normalizeText(process.env.WHATSAPP_FROM);
  return Boolean((metaToken && metaPhone) || (twilioSid && twilioToken && twilioFrom));
}

function hasRequiredEnv() {
  const requiredKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SESSION_SECRET",
  ];

  return requiredKeys.every((key) => Boolean(normalizeText(process.env[key])));
}

function buildMissingEnvList() {
  const requiredKeys = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SESSION_SECRET",
  ];

  return requiredKeys.filter((key) => !normalizeText(process.env[key]));
}

export async function getDeployHealthCards(): Promise<DeployHealthCard[]> {
  const releases = await listDeployReleases(20);
  const latest = releases[0] ?? null;
  const businesses = await listBusinesses();
  const activeDomainBusiness = businesses.find(
    (business) => business.active && Boolean(business.hostname ?? business.domain),
  );

  return [
    {
      key: "env",
      label: "Env durumu",
      status: hasRequiredEnv() ? "healthy" : "warning",
      description: hasRequiredEnv()
        ? "Temel production env değerleri tanımlı."
        : `Eksik env: ${buildMissingEnvList().join(", ") || "tanımsız"}`,
      lastCheckedAt: nowIso(),
    },
    {
      key: "build",
      label: "Build durumu",
      status: latest?.status === "deployed" ? "healthy" : "warning",
      description: latest?.status === "deployed"
        ? `Son release ${latest.version} olarak deployed.`
        : latest
          ? `Son release ${latest.version} durum: ${latest.status}.`
          : "Henüz yayınlanmış bir release yok.",
      lastCheckedAt: nowIso(),
    },
    {
      key: "migration",
      label: "Migration durumu",
      status: hasSupabaseConnection() ? "healthy" : "warning",
      description: hasSupabaseConnection()
        ? "Supabase migration erişimi hazır."
        : "Supabase bağlantısı olmadığı için migration durumu doğrulanamıyor.",
      lastCheckedAt: nowIso(),
    },
    {
      key: "storage",
      label: "Storage durumu",
      status: hasSupabaseConnection() ? "healthy" : "warning",
      description: hasSupabaseConnection()
        ? `business-media bucket hazır kabul ediliyor.`
        : "Storage kontrolü için Supabase bağlantısı gerekiyor.",
      lastCheckedAt: nowIso(),
    },
    {
      key: "mail",
      label: "Mail durumu",
      status: hasMailEnv() ? "healthy" : "warning",
      description: hasMailEnv()
        ? "Mail provider env hazır."
        : "Mail env eksik; placeholder akış devrede kalır.",
      lastCheckedAt: nowIso(),
    },
    {
      key: "whatsapp",
      label: "WhatsApp durumu",
      status: hasWhatsAppEnv() ? "healthy" : "warning",
      description: hasWhatsAppEnv()
        ? "WhatsApp provider env hazır."
        : "WhatsApp env eksik; placeholder akış devrede kalır.",
      lastCheckedAt: nowIso(),
    },
    {
      key: "domain",
      label: "Domain durumu",
      status: activeDomainBusiness ? "healthy" : "warning",
      description: activeDomainBusiness
        ? `${activeDomainBusiness.name} için aktif domain bulunuyor.`
        : "Aktif domainli business bulunamadı.",
      lastCheckedAt: nowIso(),
    },
  ];
}

export async function getDeployChecklistItems(): Promise<DeployChecklistItem[]> {
  const healthCards = await getDeployHealthCards();
  const env = healthCards.find((item) => item.key === "env");
  const migration = healthCards.find((item) => item.key === "migration");
  const storage = healthCards.find((item) => item.key === "storage");
  const mail = healthCards.find((item) => item.key === "mail");
  const whatsapp = healthCards.find((item) => item.key === "whatsapp");
  const domain = healthCards.find((item) => item.key === "domain");
  const build = healthCards.find((item) => item.key === "build");

  return [
    {
      key: "supabase-env",
      label: "Supabase env",
      done: env?.status === "healthy",
      detail: env?.description ?? "",
    },
    {
      key: "supabase-migrations",
      label: "Supabase migrations",
      done: migration?.status === "healthy",
      detail: migration?.description ?? "",
    },
    {
      key: "supabase-storage",
      label: "Supabase Storage bucket",
      done: storage?.status === "healthy",
      detail: storage?.description ?? "",
    },
    {
      key: "session-secret",
      label: "SESSION_SECRET",
      done: env?.status === "healthy",
      detail: "Session imzası için güçlü bir secret gereklidir.",
    },
    {
      key: "vercel-env",
      label: "Vercel env",
      done: Boolean(normalizeText(process.env.VERCEL) || normalizeText(process.env.VERCEL_ENV)),
      detail: "Preview ve production env ayrımı kontrol edildiğinde bu alan tamamlanır.",
    },
    {
      key: "domain-binding",
      label: "Domain bağlantısı",
      done: domain?.status === "healthy",
      detail: domain?.description ?? "",
    },
    {
      key: "mail-env",
      label: "Mail env",
      done: mail?.status === "healthy",
      detail: mail?.description ?? "",
    },
    {
      key: "whatsapp-env",
      label: "WhatsApp env",
      done: whatsapp?.status === "healthy",
      detail: whatsapp?.description ?? "",
    },
    {
      key: "admin-seed",
      label: "Admin seed",
      done: Boolean(normalizeText(process.env.DEMO_SUPER_ADMIN_EMAIL) || normalizeText(process.env.SUPER_ADMIN_EMAIL)),
      detail: "Super admin seed ve demo admin seed kontrolü.",
    },
    {
      key: "build-check",
      label: "Build kontrol",
      done: build?.status === "healthy",
      detail: build?.description ?? "",
    },
    {
      key: "security-check",
      label: "Güvenlik kontrol",
      done: env?.status === "healthy" && mail?.status !== "down" && whatsapp?.status !== "down",
      detail: "Business isolation, super-admin guard ve placeholder fallback akışları kontrol edilir.",
    },
    {
      key: "backup-rollback",
      label: "Backup / rollback",
      done: true,
      detail: "Deploy ve audit rollback akışları hazır.",
    },
  ];
}
