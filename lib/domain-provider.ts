import { normalizeDomain } from "@/lib/platform";
import type { DomainAutomationMode, DomainProviderStatus } from "@/lib/domain-utils";

type ProviderFetchResult = {
  ok: boolean;
  status: number;
  rawText: string;
  data: unknown;
};

type ProviderSyncResult = {
  mode: DomainAutomationMode;
  status: DomainProviderStatus;
  message: string;
  provider: "vercel" | "manual";
  domains: string[];
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
    throw new Error("Vercel bağlantısı eksik. VERCEL_API_TOKEN ve VERCEL_PROJECT_ID gerekli.");
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

async function readProviderResponse(response: Response): Promise<ProviderFetchResult> {
  const rawText = await response.text().catch(() => "");

  if (!rawText.trim()) {
    return {
      ok: response.ok,
      status: response.status,
      rawText: "",
      data: response.ok ? [] : null,
    };
  }

  try {
    return {
      ok: response.ok,
      status: response.status,
      rawText,
      data: JSON.parse(rawText) as unknown,
    };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      rawText,
      data: rawText,
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
    const message = typeof parsed.error === "string"
      ? parsed.error
      : typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.errorMessage === "string"
          ? parsed.errorMessage
          : "";

    return message || fallback;
  } catch {
    return rawText || fallback;
  }
}

function isAlreadyExistsError(status: number, rawText: string) {
  return (
    status === 409 ||
    /already exists|already added|domain exists|owned by another team/i.test(rawText)
  );
}

async function addVercelDomain(domain: string): Promise<ProviderFetchResult | null> {
  const config = requireVercelConfig();

  const response = await vercelFetch(`/v10/projects/${encodeURIComponent(config.projectId)}/domains`, {
    method: "POST",
    body: JSON.stringify({ name: domain }),
  });

  if (!response) {
    return null;
  }

  return readProviderResponse(response);
}

async function removeVercelDomain(domain: string): Promise<ProviderFetchResult | null> {
  const config = requireVercelConfig();

  const response = await vercelFetch(
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
    { method: "DELETE" },
  );

  if (!response) {
    return null;
  }

  return readProviderResponse(response);
}

async function inspectVercelDomain(domain: string): Promise<ProviderFetchResult | null> {
  const config = requireVercelConfig();

  const response = await vercelFetch(
    `/v9/projects/${encodeURIComponent(config.projectId)}/domains/${encodeURIComponent(domain)}`,
  );

  if (!response) {
    return null;
  }

  return readProviderResponse(response);
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
      message: "Hostname bulunamadı.",
      domains: [],
    };
  }

  const results: Array<{ domain: string; response: ProviderFetchResult | null }> = [];

  for (const domain of domains) {
    const response = await addVercelDomain(domain);
    results.push({ domain, response });

    if (!response) {
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message: "Vercel domain API yanıt vermedi.",
        domains,
      };
    }

    if (!response.ok && !isAlreadyExistsError(response.status, response.rawText)) {
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message: buildProviderErrorMessage(response.rawText, "Vercel domain eklenemedi."),
        domains,
        rawText: response.rawText,
      };
    }
  }

  const successText = results.some((item) => item.response?.ok)
    ? "Domain Vercel proje alanına eklendi."
    : "Domain zaten Vercel proje alanında bulunuyor.";

  return {
    mode: "vercel",
    provider: "vercel",
    status: "provider_added",
    message: successText,
    domains,
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
      message: "Hostname bulunamadı.",
      domains: [],
    };
  }

  for (const domain of domains) {
    const response = await removeVercelDomain(domain);

    if (!response) {
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message: "Vercel domain silme yanıtı alınamadı.",
        domains,
      };
    }

    if (!response.ok && response.status !== 404) {
      return {
        mode: "vercel",
        provider: "vercel",
        status: "failed",
        message: buildProviderErrorMessage(response.rawText, "Vercel domain silinemedi."),
        domains,
        rawText: response.rawText,
      };
    }
  }

  return {
    mode: "vercel",
    provider: "vercel",
    status: "pending",
    message: "Domain Vercel projeden kaldırıldı.",
    domains,
  };
}

export async function inspectBusinessDomainProvider(
  hostname: string | null | undefined,
): Promise<{ domains: Array<{ domain: string; ok: boolean; status: number; rawText: string; data: unknown }> }> {
  const domains = getManagedDomainVariants(hostname);
  const rows: Array<{ domain: string; ok: boolean; status: number; rawText: string; data: unknown }> = [];

  for (const domain of domains) {
    const response = await inspectVercelDomain(domain);
    rows.push({
      domain,
      ok: response?.ok ?? false,
      status: response?.status ?? 0,
      rawText: response?.rawText ?? "",
      data: response?.data ?? null,
    });
  }

  return { domains: rows };
}
