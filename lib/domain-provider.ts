import { normalizeDomain } from "@/lib/platform";
import type {
  DomainAutomationMode,
  DomainProviderStatus,
  DomainVerificationRecord,
} from "@/lib/domain-utils";

type ProviderFetchResult = {
  ok: boolean;
  status: number;
  rawText: string;
  data: unknown;
  verification: DomainVerificationRecord | null;
  error: string | null;
  conflicts: string[];
  misconfigured: boolean;
};

type ProviderSyncResult = {
  mode: DomainAutomationMode;
  status: DomainProviderStatus;
  message: string;
  provider: "vercel" | "manual";
  domains: string[];
  verification: DomainVerificationRecord | null;
  error: string | null;
  conflicts: string[];
  misconfigured: boolean;
  rawText?: string;
};

function normalizeHostname(hostname: string | null | undefined) {
  return normalizeDomain(hostname);
}

function buildManagedDomainVariants(hostname: string | null | undefined) {
  const normalized = normalizeHostname(hostname);

  if (!normalized) {
    return [];
  }

  return Array.from(new Set([normalized, `www.${normalized}`]));
}

function getVercelConfig() {
  const token = process.env.VERCEL_API_TOKEN?.trim() || "";
  const projectId = process.env.VERCEL_PROJECT_ID?.trim() || "";
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || "";

  if (!token || !projectId) {
    return null;
  }

  return { token, projectId, teamId };
}

function requireVercelConfig() {
  const config = getVercelConfig();

  if (!config) {
    throw new Error("Vercel baglantisi eksik. VERCEL_API_TOKEN ve VERCEL_PROJECT_ID gerekli.");
  }

  return config;
}

export function getDomainAutomationMode(): DomainAutomationMode {
  return getVercelConfig() ? "vercel" : "manual";
}

export function hasVercelDomainAutomation() {
  return getDomainAutomationMode() === "vercel";
}

export function getManagedDomainVariants(hostname: string | null | undefined) {
  return buildManagedDomainVariants(hostname);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function pickBoolean(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  return false;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function extractVerification(data: unknown): DomainVerificationRecord | null {
  const record = asRecord(data);

  if (!record) {
    return null;
  }

  const nested = asRecord(record.verification) ?? asRecord(record.ownershipVerification);
  const rawRequired = pickBoolean(
    nested?.required,
    record.verificationRequired,
    record.verification_required,
    record.requiresVerification,
    record.requires_verification,
  );
  const rawType = pickString(
    nested?.type,
    nested?.recordType,
    nested?.record_type,
    record.verificationType,
    record.verification_type,
  );
  const rawName = pickString(
    nested?.name,
    nested?.hostname,
    nested?.host,
    record.verificationName,
    record.verification_name,
  );
  const rawValue = pickString(
    nested?.value,
    nested?.target,
    nested?.content,
    record.verificationValue,
    record.verification_value,
  );

  if (!rawRequired && !rawType && !rawName && !rawValue) {
    return null;
  }

  return {
    required: rawRequired,
    type: rawType || null,
    name: rawName || null,
    value: rawValue || null,
  };
}

function extractErrorMessage(data: unknown, fallback = "") {
  const record = asRecord(data);

  if (!record) {
    return fallback;
  }

  return (
    pickString(
      record.error,
      record.message,
      record.errorMessage,
      record.error_message,
      record.reason,
      record.detail,
      record.details,
    ) || fallback
  );
}

function extractConflicts(data: unknown) {
  const record = asRecord(data);

  if (!record) {
    return [];
  }

  return [
    ...toStringArray(record.conflicts),
    ...toStringArray(record.conflict),
    ...toStringArray(record.issues),
  ];
}

function looksLikeTeamConflict(rawText: string) {
  return /owned by another team|belongs to another team|another team|another project|conflict/i.test(
    rawText,
  );
}

function looksLikeAlreadyExists(rawText: string) {
  return /already exists|already added|already attached|already on the project/i.test(rawText);
}

async function readProviderResponse(response: Response): Promise<ProviderFetchResult> {
  const rawText = await response.text().catch(() => "");
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      ok: response.ok,
      status: response.status,
      rawText: "",
      data: response.ok ? [] : null,
      verification: null,
      error: null,
      conflicts: [],
      misconfigured: false,
    };
  }

  try {
    const data = JSON.parse(trimmed) as unknown;
    const verification = extractVerification(data);
    const error = extractErrorMessage(data);
    const conflicts = extractConflicts(data);
    const misconfigured =
      /misconfig|misconfigured|configuration/i.test(trimmed) ||
      Boolean(asRecord(data)?.misconfigured) ||
      Boolean(asRecord(data)?.isMisconfigured);

    return {
      ok: response.ok,
      status: response.status,
      rawText,
      data,
      verification,
      error: error || null,
      conflicts,
      misconfigured,
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      rawText,
      data: rawText,
      verification: null,
      error: extractErrorMessage(rawText, rawText),
      conflicts: [],
      misconfigured: /misconfig|misconfigured|configuration/i.test(rawText),
    };
  }
}

async function vercelFetch(path: string, init?: RequestInit) {
  const config = requireVercelConfig();
  const url = new URL(`https://api.vercel.com${path}`);

  if (config.teamId) {
    url.searchParams.set("teamId", config.teamId);
  }

  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function buildProviderErrorMessage(rawText: string, fallback: string) {
  if (!rawText.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    const message =
      pickString(parsed.error, parsed.message, parsed.errorMessage, parsed.detail, parsed.reason) ||
      fallback;
    return message;
  } catch {
    return rawText || fallback;
  }
}

function isConflictError(status: number, rawText: string) {
  return (
    status === 409 ||
    looksLikeTeamConflict(rawText) ||
    /conflict/i.test(rawText)
  );
}

function isAlreadyExistsError(status: number, rawText: string) {
  return status === 409 || looksLikeAlreadyExists(rawText);
}

async function addVercelDomain(domain: string): Promise<ProviderFetchResult | null> {
  const config = requireVercelConfig();
  const response = await vercelFetch(
    `/v10/projects/${encodeURIComponent(config.projectId)}/domains`,
    {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    },
  );

  return readProviderResponse(response);
}

async function removeVercelDomain(domain: string): Promise<ProviderFetchResult | null> {
  const config = requireVercelConfig();
  const response = await vercelFetch(
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" },
  );

  return readProviderResponse(response);
}

async function inspectVercelDomain(domain: string): Promise<ProviderFetchResult | null> {
  const config = requireVercelConfig();
  const response = await vercelFetch(
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
  );

  return readProviderResponse(response);
}

function mergeVerification(
  first: DomainVerificationRecord | null,
  second: DomainVerificationRecord | null,
) {
  return first ?? second ?? null;
}

function mergeMessages(...parts: Array<string | null | undefined>) {
  return parts.map((part) => part?.trim()).filter(Boolean).join(" | ");
}

export async function syncBusinessDomainWithProvider(
  hostname: string | null | undefined,
): Promise<ProviderSyncResult> {
  const domains = getManagedDomainVariants(hostname);

  if (!domains.length) {
    return {
      mode: "manual",
      provider: "manual",
      status: "manual",
      message: "Hostname bulunamadi.",
      domains: [],
      verification: null,
      error: null,
      conflicts: [],
      misconfigured: false,
    };
  }

  const results: Array<{ domain: string; response: ProviderFetchResult | null }> = [];
  let verification: DomainVerificationRecord | null = null;
  let providerError: string | null = null;
  let conflicts: string[] = [];
  let misconfigured = false;

  for (const domain of domains) {
    const response = await addVercelDomain(domain);
    results.push({ domain, response });

    if (!response) {
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message: "Vercel domain API yanit vermedi.",
        domains,
        verification,
        error: "Vercel domain API yanit vermedi.",
        conflicts,
        misconfigured,
      };
    }

    verification = mergeVerification(verification, response.verification);
    conflicts = [...conflicts, ...response.conflicts];
    misconfigured = misconfigured || response.misconfigured;

    if (!response.ok) {
      const message = buildProviderErrorMessage(response.rawText, "Vercel domain eklenemedi.");
      providerError = mergeMessages(providerError, message);

      if (isConflictError(response.status, response.rawText)) {
        return {
          mode: "vercel",
          provider: "vercel",
          status: "failed",
          message,
          domains,
          verification,
          error: message,
          conflicts,
          misconfigured,
          rawText: response.rawText,
        };
      }

      if (!isAlreadyExistsError(response.status, response.rawText)) {
        return {
          mode: "vercel",
          provider: "vercel",
          status: "failed",
          message,
          domains,
          verification,
          error: message,
          conflicts,
          misconfigured,
          rawText: response.rawText,
        };
      }
    }
  }

  const successText = results.some((item) => item.response?.ok)
    ? "Domain Vercel proje alanina eklendi."
    : "Domain zaten Vercel proje alaninda bulunuyor.";

  return {
    mode: "vercel",
    provider: "vercel",
    status: "provider_added",
    message: successText,
    domains,
    verification,
    error: providerError,
    conflicts,
    misconfigured,
  };
}

export async function removeBusinessDomainFromProvider(
  hostname: string | null | undefined,
): Promise<ProviderSyncResult> {
  const domains = getManagedDomainVariants(hostname);

  if (!domains.length) {
    return {
      mode: "manual",
      provider: "manual",
      status: "manual",
      message: "Hostname bulunamadi.",
      domains: [],
      verification: null,
      error: null,
      conflicts: [],
      misconfigured: false,
    };
  }

  for (const domain of domains) {
    const response = await removeVercelDomain(domain);

    if (!response) {
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message: "Vercel domain silme yaniti alinamadi.",
        domains,
        verification: null,
        error: "Vercel domain silme yaniti alinamadi.",
        conflicts: [],
        misconfigured: false,
      };
    }

    if (!response.ok && response.status !== 404) {
      const message = buildProviderErrorMessage(response.rawText, "Vercel domain silinemedi.");
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message,
        domains,
        verification: response.verification,
        error: message,
        conflicts: response.conflicts,
        misconfigured: response.misconfigured,
        rawText: response.rawText,
      };
    }
  }

  return {
    mode: "vercel",
    provider: "vercel",
    status: "pending",
    message: "Domain Vercel projeden kaldirildi.",
    domains,
    verification: null,
    error: null,
    conflicts: [],
    misconfigured: false,
  };
}

export async function inspectBusinessDomainProvider(
  hostname: string | null | undefined,
): Promise<{
  domains: Array<{
    domain: string;
    ok: boolean;
    status: number;
    rawText: string;
    data: unknown;
    verification: DomainVerificationRecord | null;
    error: string | null;
    conflicts: string[];
    misconfigured: boolean;
  }>;
}> {
  const domains = getManagedDomainVariants(hostname);
  const rows: Array<{
    domain: string;
    ok: boolean;
    status: number;
    rawText: string;
    data: unknown;
    verification: DomainVerificationRecord | null;
    error: string | null;
    conflicts: string[];
    misconfigured: boolean;
  }> = [];

  for (const domain of domains) {
    const response = await inspectVercelDomain(domain);
    rows.push({
      domain,
      ok: response?.ok ?? false,
      status: response?.status ?? 0,
      rawText: response?.rawText ?? "",
      data: response?.data ?? null,
      verification: response?.verification ?? null,
      error: response?.error ?? null,
      conflicts: response?.conflicts ?? [],
      misconfigured: response?.misconfigured ?? false,
    });
  }

  return { domains: rows };
}
