import { isReservedPlatformDomain, normalizeDomain } from "@/lib/platform";

export type DomainStatus =
  | "pending"
  | "provider_added"
  | "dns_detected"
  | "verified"
  | "ssl_ready"
  | "active"
  | "failed";

export type DomainDnsStatus = "pending" | "detected" | "verified" | "misconfigured" | "failed";

export type DomainSslStatus = "pending" | "checking" | "ready" | "failed" | "active";

export type DomainAppStatus = "pending" | "checking" | "ready" | "failed";

export type DomainAutomationMode = "vercel" | "manual";

export type DomainProviderStatus = "pending" | "provider_added" | "manual" | "failed";

export type DomainVerificationRecord = {
  required: boolean;
  type: string | null;
  name: string | null;
  value: string | null;
};

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
    description: "Vercel custom domain akisi icin onerilen kayitlar.",
  },
  {
    value: "cloudflare",
    label: "Cloudflare",
    description: "Cloudflare DNS uzerinden yoneten ekipler icin.",
  },
  {
    value: "godaddy",
    label: "GoDaddy",
    description: "GoDaddy DNS paneli icin hizli kurulum rehberi.",
  },
  {
    value: "namecheap",
    label: "Namecheap",
    description: "Namecheap alan adi yonetimi icin yonlendirme akisi.",
  },
  {
    value: "turhost",
    label: "Turhost",
    description: "Turhost DNS paneli icin adim adim rehber.",
  },
  {
    value: "natro",
    label: "Natro",
    description: "Natro kullanicilari icin profesyonel yonlendirme.",
  },
  {
    value: "isimtescil",
    label: "Isimtescil",
    description: "Isimtescil DNS ekrani icin hizli kurulum.",
  },
  {
    value: "hostinger",
    label: "Hostinger",
    description: "Hostinger DNS yonlendirme akisi.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Ozel DNS saglayicisi icin genel onboarding.",
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
      return "Saglayiciya eklendi";
    case "dns_detected":
      return "DNS algilandi";
    case "verified":
      return "Dogrulandi";
    case "ssl_ready":
      return "SSL hazir";
    case "active":
      return "Aktif";
    case "failed":
      return "Basarisiz";
    case "pending":
    default:
      return "Bekliyor";
  }
}

export function formatDnsStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "detected":
    case "dns_detected":
      return "DNS algilandi";
    case "verified":
      return "DNS dogrulandi";
    case "misconfigured":
      return "DNS hatali";
    case "failed":
      return "DNS basarisiz";
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
      return "SSL hazir";
    case "failed":
      return "SSL basarisiz";
    case "pending":
    default:
      return "Bekliyor";
  }
}

export function formatAppStatusLabel(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "checking":
      return "Kontrol ediliyor";
    case "ready":
      return "Ulasiliyor";
    case "failed":
      return "Ulasilmiyor";
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

export function isDomainProviderConnected(providerStatus: string | null | undefined) {
  return String(providerStatus ?? "").trim().toLowerCase() !== "manual";
}

export function isDomainDnsHealthy(status: string | null | undefined) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "detected":
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

export function isDomainAppReachable(status: string | null | undefined) {
  return String(status ?? "").trim().toLowerCase() === "ready";
}

export function isDomainPubliclyReachable(input: {
  domainStatus?: string | null;
  domainProviderStatus?: string | null;
  sslStatus?: string | null;
  dnsStatus?: string | null;
  appStatus?: string | null;
}) {
  const status = String(input.domainStatus ?? "").trim().toLowerCase();

  return (
    status === "active" &&
    isDomainProviderConnected(input.domainProviderStatus) &&
    isDomainDnsHealthy(input.dnsStatus ?? status) &&
    isDomainSslReady(input.sslStatus) &&
    isDomainAppReachable(input.appStatus)
  );
}

export function getDnsCnameTarget() {
  return getProductionTargetDomain() ?? "cname.vercel-dns.com";
}

function buildProviderGuide(
  provider: DomainProvider,
  hostname: string,
  token: string,
  verification: DomainVerificationRecord | null,
) {
  const apexHost = getApexHost(hostname);
  const subHost = getSubdomainHost(hostname);
  const verificationHost = verification?.name?.trim() || "_vercel";
  const verificationValue = verification?.value?.trim() || token;

  switch (provider) {
    case "cloudflare":
      return {
        guide: [
          "Domaini Cloudflare DNS ekranina ekleyin.",
          `A kaydini ${apexHost} icin tanimlayin.`,
          `CNAME kaydini ${subHost} icin olusturun.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} kullanin.`,
        ],
      };
    case "godaddy":
      return {
        guide: [
          "GoDaddy DNS yonetiminden alan adini acin.",
          `A kaydini ${apexHost} icin ekleyin.`,
          `CNAME kaydini ${subHost} icin ekleyin.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} yazin.`,
        ],
      };
    case "namecheap":
      return {
        guide: [
          "Namecheap Advanced DNS bolumunu acin.",
          `A kaydini ${apexHost} icin tanimlayin.`,
          `CNAME kaydini ${subHost} icin olusturun.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} ekleyin.`,
        ],
      };
    case "turhost":
      return {
        guide: [
          "Turhost DNS panelinden kayit ekleyin.",
          `A kaydini ${apexHost} icin olusturun.`,
          `CNAME kaydini ${subHost} icin yonlendirin.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} kullanin.`,
        ],
      };
    case "natro":
      return {
        guide: [
          "Natro DNS yonetim alanina giris yapin.",
          `A kaydini ${apexHost} icin ekleyin.`,
          `CNAME kaydini ${subHost} icin ekleyin.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} ekleyin.`,
        ],
      };
    case "isimtescil":
      return {
        guide: [
          "Isimtescil DNS yonetim ekranini acin.",
          `A kaydini ${apexHost} icin olusturun.`,
          `CNAME kaydini ${subHost} icin olusturun.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} doldurun.`,
        ],
      };
    case "hostinger":
      return {
        guide: [
          "Hostinger DNS zone yonetimini acin.",
          `A kaydini ${apexHost} icin tanimlayin.`,
          `CNAME kaydini ${subHost} icin olusturun.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} girin.`,
        ],
      };
    case "vercel":
    case "custom":
    default:
      return {
        guide: [
          "DNS yonetim ekraninda domain kaydini acin.",
          `Root domain icin A kaydini ${apexHost} hedefi ile ekleyin.`,
          `Subdomain icin CNAME kaydini ${subHost} hedefi ile ekleyin.`,
          `TXT dogrulama gerekirse ${verificationHost} = ${verificationValue} kullanin.`,
        ],
      };
  }
}

function buildProviderRecords(
  hostname: string,
  token: string,
  cnameTarget: string,
  verification: DomainVerificationRecord | null,
) {
  const apexHost = getApexHost(hostname);
  const subHost = getSubdomainHost(hostname);
  const verificationHost = verification?.name?.trim() || "_vercel";
  const verificationValue = verification?.value?.trim() || token;

  const records: DomainDnsRecord[] = [
    {
      type: "A",
      host: apexHost,
      value: "76.76.21.21",
      note: "Root domain icin A kaydi",
    },
    {
      type: "CNAME",
      host: subHost,
      value: cnameTarget,
      note: "Subdomain icin CNAME",
    },
  ];

  if (verification?.required || verificationValue) {
    records.push({
      type: "TXT",
      host: verificationHost,
      value: verificationValue,
      note: verification?.required ? "Vercel ownership verification" : "TXT dogrulama tokeni",
    });
  }

  return records;
}

export function buildDomainAdapters(
  hostname: string,
  verificationToken: string,
  options?: {
    cnameTarget?: string | null;
    verification?: DomainVerificationRecord | null;
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
    guide: buildProviderGuide(provider, safeHostname, safeToken, options?.verification ?? null).guide,
    records: buildProviderRecords(safeHostname, safeToken, cnameTarget, options?.verification ?? null),
  }));
}
