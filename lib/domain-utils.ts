import { isReservedPlatformDomain, normalizeDomain } from "@/lib/platform";

export type DomainStatus =
  | "pending"
  | "provider_added"
  | "dns_detected"
  | "verified"
  | "ssl_ready"
  | "active"
  | "failed";

export type DomainSslStatus = "pending" | "checking" | "ready" | "failed" | "active";

export type DomainAutomationMode = "vercel" | "manual";

export type DomainProviderStatus = "pending" | "provider_added" | "manual" | "failed";

export type DomainProvider =
  | "vercel"
  | "cloudflare"
  | "godaddy"
  | "namecheap"
  | "turhost"
  | "natro"
  | "isimtescil"
  | "hostinger"
  | "custom";

export const DOMAIN_STATUS_OPTIONS: DomainStatus[] = [
  "pending",
  "provider_added",
  "dns_detected",
  "verified",
  "ssl_ready",
  "active",
  "failed",
];

export const DOMAIN_PROVIDER_OPTIONS: Array<{
  value: DomainProvider;
  label: string;
  description: string;
}> = [
  {
    value: "vercel",
    label: "Vercel",
    description: "Vercel custom domain akışı için önerilen kayıtlar.",
  },
  {
    value: "cloudflare",
    label: "Cloudflare",
    description: "Cloudflare DNS üzerinden yöneten ekipler için.",
  },
  {
    value: "godaddy",
    label: "GoDaddy",
    description: "GoDaddy DNS paneli için hızlı kurulum rehberi.",
  },
  {
    value: "namecheap",
    label: "Namecheap",
    description: "Namecheap alan adı yönetimi için yönlendirme akışı.",
  },
  {
    value: "turhost",
    label: "Turhost",
    description: "Turhost DNS paneli için adım adım rehber.",
  },
  {
    value: "natro",
    label: "Natro",
    description: "Natro kullanıcıları için profesyonel yönlendirme.",
  },
  {
    value: "isimtescil",
    label: "İsimtescil",
    description: "İsimtescil DNS ekranı için hızlı kurulum.",
  },
  {
    value: "hostinger",
    label: "Hostinger",
    description: "Hostinger DNS yönlendirme akışı.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Özel DNS sağlayıcısı için genel onboarding.",
  },
];

export type DomainDnsRecord = {
  type: "A" | "CNAME" | "TXT";
  host: string;
  value: string;
  note: string;
};

export type DomainAdapter = {
  provider: DomainProvider;
  label: string;
  guide: string[];
  records: DomainDnsRecord[];
};

function normalizeHost(hostname: string) {
  return hostname.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function isLikelyRootDomain(hostname: string) {
  const parts = normalizeHost(hostname).split(".").filter(Boolean);
  return parts.length <= 2;
}

function getApexHost(hostname: string) {
  return isLikelyRootDomain(hostname) ? "@" : hostname;
}

function getSubdomainHost(hostname: string) {
  return isLikelyRootDomain(hostname) ? `www.${normalizeHost(hostname)}` : hostname;
}

export function buildDomainVerificationToken(seed?: string | null) {
  const normalized = String(seed ?? "").trim();

  if (normalized) {
    return normalized;
  }

  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }

  return `verify-${Math.random().toString(36).slice(2, 14)}`;
}

export function getDomainStepIndex(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "pending":
    case "provider_added":
      return 0;
    case "dns_detected":
      return 1;
    case "verified":
      return 2;
    case "ssl_ready":
      return 3;
    case "active":
      return 4;
    default:
      return -1;
  }
}

export function formatDomainStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "provider_added":
      return "Sağlayıcıya eklendi";
    case "dns_detected":
      return "DNS algılandı";
    case "verified":
      return "Doğrulandı";
    case "ssl_ready":
      return "SSL hazır";
    case "active":
      return "Aktif";
    case "failed":
      return "Başarısız";
    case "pending":
    default:
      return "Bekliyor";
  }
}

export function formatSslStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "checking":
      return "Kontrol ediliyor";
    case "issued":
    case "ready":
    case "active":
      return "SSL hazır";
    case "failed":
      return "SSL başarısız";
    case "pending":
    default:
      return "Bekliyor";
  }
}

export function getProductionTargetDomain() {
  return normalizeDomain(process.env.PUBLIC_DOMAIN_TARGET);
}

export function hasProductionTargetDomain() {
  return Boolean(getProductionTargetDomain());
}

export function getBusinessPublicTarget(hostname: string | null | undefined) {
  const normalized = normalizeDomain(hostname);

  if (normalized && !isReservedPlatformDomain(normalized)) {
    return `https://${normalized}`;
  }

  return null;
}

export function isDomainProviderConnected(
  providerStatus: string | null | undefined,
) {
  return String(providerStatus ?? "").trim().toLowerCase() !== "manual";
}

export function isDomainDnsHealthy(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "dns_detected":
    case "verified":
    case "ssl_ready":
    case "active":
      return true;
    default:
      return false;
  }
}

export function isDomainSslReady(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "ready":
    case "active":
      return true;
    default:
      return false;
  }
}

export function isDomainPubliclyReachable(input: {
  domainStatus?: string | null;
  domainProviderStatus?: string | null;
  sslStatus?: string | null;
}) {
  const status = String(input.domainStatus ?? "").trim().toLowerCase();

  return (
    status === "active" &&
    isDomainProviderConnected(input.domainProviderStatus) &&
    isDomainSslReady(input.sslStatus)
  );
}

export function getDnsCnameTarget() {
  return getProductionTargetDomain() ?? "cname.vercel-dns.com";
}

function buildProviderGuide(provider: DomainProvider, hostname: string, token: string) {
  const apexHost = getApexHost(hostname);
  const subHost = getSubdomainHost(hostname);

  switch (provider) {
    case "cloudflare":
      return {
        guide: [
          "Domaini Cloudflare DNS ekranına ekleyin.",
          `A kaydını ${apexHost} için tanımlayın.`,
          `CNAME kaydını ${subHost} için oluşturun.`,
          `TXT doğrulama kaydına ${token} değerini girin.`,
        ],
      };
    case "godaddy":
      return {
        guide: [
          "GoDaddy DNS yönetiminden alan adını açın.",
          `A kaydını ${apexHost} için ekleyin.`,
          `CNAME kaydını ${subHost} için ekleyin.`,
          `TXT doğrulama kaydına ${token} değerini yazın.`,
        ],
      };
    case "namecheap":
      return {
        guide: [
          "Namecheap Advanced DNS bölümünü açın.",
          `A kaydını ${apexHost} için tanımlayın.`,
          `CNAME kaydını ${subHost} için oluşturun.`,
          `TXT kaydına ${token} doğrulama tokenini ekleyin.`,
        ],
      };
    case "turhost":
      return {
        guide: [
          "Turhost DNS panelinden kayıt ekleyin.",
          `A kaydını ${apexHost} için oluşturun.`,
          `CNAME kaydını ${subHost} için yönlendirin.`,
          `TXT doğrulama kaydına ${token} değerini girin.`,
        ],
      };
    case "natro":
      return {
        guide: [
          "Natro DNS yönetim alanına giriş yapın.",
          `A kaydını ${apexHost} için ekleyin.`,
          `CNAME kaydını ${subHost} için ekleyin.`,
          `TXT doğrulama alanına ${token} ekleyin.`,
        ],
      };
    case "isimtescil":
      return {
        guide: [
          "İsimtescil DNS yönetim ekranını açın.",
          `A kaydını ${apexHost} için oluşturun.`,
          `CNAME kaydını ${subHost} için oluşturun.`,
          `TXT doğrulama kaydını ${token} ile doldurun.`,
        ],
      };
    case "hostinger":
      return {
        guide: [
          "Hostinger DNS zone yönetimini açın.",
          `A kaydını ${apexHost} için tanımlayın.`,
          `CNAME kaydını ${subHost} için oluşturun.`,
          `TXT doğrulama tokenini ${token} ile girin.`,
        ],
      };
    case "vercel":
    case "custom":
    default:
      return {
        guide: [
          "DNS yönetim ekranında domain kaydını açın.",
          `Root domain için A kaydını ${apexHost} hedefi ile ekleyin.`,
          `Subdomain için CNAME kaydını ${subHost} hedefi ile ekleyin.`,
          `TXT doğrulama kaydına ${token} tokenini ekleyin.`,
        ],
      };
  }
}

function buildProviderRecords(hostname: string, token: string, cnameTarget: string) {
  const apexHost = getApexHost(hostname);
  const subHost = getSubdomainHost(hostname);
  const verifyHost = `_verify.${normalizeHost(hostname).replace(/^www\./i, "")}`;

  return [
    {
      type: "A" as const,
      host: apexHost,
      value: "76.76.21.21",
      note: "Root domain için A kaydı",
    },
    {
      type: "CNAME" as const,
      host: subHost,
      value: cnameTarget,
      note: "Subdomain için CNAME",
    },
    {
      type: "TXT" as const,
      host: verifyHost,
      value: token,
      note: "TXT doğrulama tokeni",
    },
  ];
}

export function buildDomainAdapters(
  hostname: string,
  verificationToken: string,
  options?: {
    cnameTarget?: string | null;
  },
): DomainAdapter[] {
  const safeHostname = normalizeHost(hostname) || "firma.com";
  const safeToken = buildDomainVerificationToken(verificationToken);
  const cnameTarget = normalizeDomain(options?.cnameTarget) || "cname.vercel-dns.com";

  const providers: DomainProvider[] = [
    "vercel",
    "cloudflare",
    "godaddy",
    "namecheap",
    "turhost",
    "natro",
    "isimtescil",
    "hostinger",
    "custom",
  ];

  return providers.map((provider) => ({
    provider,
    label: DOMAIN_PROVIDER_OPTIONS.find((item) => item.value === provider)?.label ?? provider,
    guide: buildProviderGuide(provider, safeHostname, safeToken).guide,
    records: buildProviderRecords(safeHostname, safeToken, cnameTarget),
  }));
}
