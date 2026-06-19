export type DomainStatus =
  | "pending"
  | "dns_detected"
  | "verified"
  | "active"
  | "failed";

export type DomainSslStatus = "pending" | "issued" | "active" | "failed";

export type DomainProvider = "vercel" | "cloudflare" | "custom";

export const DOMAIN_STATUS_OPTIONS: DomainStatus[] = [
  "pending",
  "dns_detected",
  "verified",
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
    description: "Vercel baglantisi icin yonlendirme ve DNS kontrolu.",
  },
  {
    value: "cloudflare",
    label: "Cloudflare",
    description: "Cloudflare DNS uzerinden kontrollu baglama akisi.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Kendi DNS saglayiciniz icin genel baglama akisi.",
  },
];

export type DomainDnsRecord = {
  type: string;
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

export function formatDomainStatusLabel(status: string | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();

  switch (normalized) {
    case "dns_detected":
      return "DNS algılandı";
    case "verified":
      return "Doğrulandı";
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
  const normalized = String(status ?? "").trim().toLowerCase();

  switch (normalized) {
    case "issued":
      return "Sertifika hazır";
    case "active":
      return "SSL aktif";
    case "failed":
      return "SSL başarısız";
    case "pending":
    default:
      return "Bekliyor";
  }
}

export function buildDomainAdapters(
  hostname: string,
  verificationToken: string,
): DomainAdapter[] {
  const safeHostname = hostname.trim() || "firma.com";
  const safeToken = verificationToken.trim() || "verification-token";

  return [
    {
      provider: "vercel",
      label: "Vercel",
      guide: [
        "Project settings içinden custom domain ekleyin.",
        "DNS tarafında CNAME kaydı oluşturun.",
        "Doğrulama sonrası bu panelde durumu kontrol edin.",
      ],
      records: [
        {
          type: "CNAME",
          host: safeHostname,
          value: "cname.vercel-dns.com",
          note: "Ana domain için CNAME yönlendirmesi",
        },
        {
          type: "TXT",
          host: `_verify.${safeHostname}`,
          value: safeToken,
          note: "Sahiplik doğrulama tokeni",
        },
      ],
    },
    {
      provider: "cloudflare",
      label: "Cloudflare",
      guide: [
        "DNS ekranında domain kaydını ekleyin.",
        "Proxy durumunu gerekirse kapalı tutun.",
        "Doğrulama için TXT token değerini kullanın.",
      ],
      records: [
        {
          type: "CNAME",
          host: safeHostname,
          value: "origin.busetatransfer.com",
          note: "Cloudflare yönlendirme kaydı",
        },
        {
          type: "TXT",
          host: `_verify.${safeHostname}`,
          value: safeToken,
          note: "Doğrulama tokeni",
        },
      ],
    },
    {
      provider: "custom",
      label: "Custom",
      guide: [
        "Kendi DNS sağlayıcınızda domain kaydını oluşturun.",
        "Domaini public siteye yönlendirin.",
        "Bu panel şimdilik DNS sonucu yerine hazır rehber gösterir.",
      ],
      records: [
        {
          type: "CNAME",
          host: safeHostname,
          value: "public.busetatransfer.com",
          note: "Genel public hedef",
        },
        {
          type: "TXT",
          host: `_verify.${safeHostname}`,
          value: safeToken,
          note: "Doğrulama tokeni",
        },
      ],
    },
  ];
}
