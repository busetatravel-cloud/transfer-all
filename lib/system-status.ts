import "server-only";

import { getSessionSecret } from "@/lib/session";
import { hasSupabaseConnection } from "@/lib/supabase-config";
import { listBusinesses } from "@/lib/business";
import { getPublicSiteDataByBusinessId } from "@/lib/public-site";
import { getBusinessRequests } from "@/lib/requests";
import { getBusinessVoucherByRequestId } from "@/lib/vouchers";

export type SystemStatusState = "healthy" | "warning" | "down";

export type SystemStatusCard = {
  key: string;
  label: string;
  status: SystemStatusState;
  description: string;
  lastCheckedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

async function buildSupabaseCard(): Promise<SystemStatusCard> {
  const status = hasSupabaseConnection() ? "healthy" : "warning";

  return {
    key: "supabase",
    label: "Supabase",
    status,
    description: hasSupabaseConnection()
      ? "Supabase bağlantısı mevcut ve servis katmanı kullanılabiliyor."
      : "Supabase bağlantısı tanımlı değil. Panel demo/veri yedek modunda çalışıyor.",
    lastCheckedAt: nowIso(),
  };
}

async function buildAuthCard(): Promise<SystemStatusCard> {
  const secret = getSessionSecret();
  const isCustomSecret =
    !!secret.trim() && secret !== "dev-session-secret-change-me";

  return {
    key: "auth",
    label: "Auth",
    status: isCustomSecret ? "healthy" : "warning",
    description: isCustomSecret
      ? "Session secret tanımlı ve auth akışı hazır."
      : "Session secret varsayılan geliştirme değeri kullanıyor.",
    lastCheckedAt: nowIso(),
  };
}

async function buildPublicSiteCard(): Promise<SystemStatusCard> {
  const businesses = await listBusinesses();
  const candidate = businesses.find((item) => item.active && item.domain);

  if (!candidate) {
    return {
      key: "public-site",
      label: "Public site",
      status: "warning",
      description: "Aktif domainli business bulunamadı.",
      lastCheckedAt: nowIso(),
    };
  }

  const publicPanel = await getPublicSiteDataByBusinessId(candidate.id);

  return {
    key: "public-site",
    label: "Public site",
    status: publicPanel ? "healthy" : "warning",
    description: publicPanel
      ? "Public site verisi businessId üzerinden çözümlenebiliyor."
      : "Public site taslağı henüz hazır değil ya da yayınlanmış veri yok.",
    lastCheckedAt: nowIso(),
  };
}

async function buildDomainCard(): Promise<SystemStatusCard> {
  const businesses = await listBusinesses();
  const withDomain = businesses.filter((item) => item.active && item.domain);
  const pending = withDomain.filter((item) => item.domainStatus !== "active");

  if (!withDomain.length) {
    return {
      key: "domain",
      label: "Domain",
      status: "warning",
      description: "Bağlı domain bulunamadı.",
      lastCheckedAt: nowIso(),
    };
  }

  return {
    key: "domain",
    label: "Domain",
    status: pending.length ? "warning" : "healthy",
    description: pending.length
      ? `${pending.length} domain aktif onayını bekliyor.`
      : "Aktif domainler doğrulanmış durumda.",
    lastCheckedAt: nowIso(),
  };
}

async function buildVoucherCard(): Promise<SystemStatusCard> {
  const businesses = await listBusinesses();
  const candidate = businesses.find((item) => item.active);

  if (!candidate) {
    return {
      key: "voucher",
      label: "Voucher",
      status: "warning",
      description: "Kontrol edilecek aktif business bulunamadı.",
      lastCheckedAt: nowIso(),
    };
  }

  const requests = await getBusinessRequests(candidate.id);
  const request = requests[0] ?? null;
  const voucher = request ? await getBusinessVoucherByRequestId(candidate.id, request.id) : null;

  return {
    key: "voucher",
    label: "Voucher",
    status: voucher ? "healthy" : "warning",
    description: voucher
      ? "Voucher akışı çalışıyor ve örnek kayıt çözümlenebiliyor."
      : "Voucher akışı hazır, ancak kontrol edilen örnek kayıtta voucher bulunamadı.",
    lastCheckedAt: nowIso(),
  };
}

function buildPlaceholderCard(
  key: string,
  label: string,
  description: string,
): SystemStatusCard {
  return {
    key,
    label,
    status: "warning",
    description,
    lastCheckedAt: nowIso(),
  };
}

export async function getSystemStatusCards() {
  const [supabase, auth, publicSite, domain, voucher] = await Promise.all([
    buildSupabaseCard(),
    buildAuthCard(),
    buildPublicSiteCard(),
    buildDomainCard(),
    buildVoucherCard(),
  ]);

  return [
    supabase,
    auth,
    publicSite,
    domain,
    voucher,
    buildPlaceholderCard(
      "mail",
      "Mail placeholder",
      "Gerçek mail entegrasyonu bağlı değil; sadece hazırlık katmanı mevcut.",
    ),
    buildPlaceholderCard(
      "whatsapp",
      "WhatsApp placeholder",
      "Gerçek WhatsApp API bağlı değil; sadece hazırlık katmanı mevcut.",
    ),
    buildPlaceholderCard(
      "upload",
      "Upload placeholder",
      "Gerçek dosya yükleme entegrasyonu bağlı değil; medya işlemleri panel içinden yönetiliyor.",
    ),
  ];
}
