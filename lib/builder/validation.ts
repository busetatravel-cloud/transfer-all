import type { BuilderValidationIssue } from "@/lib/builder/types";

// Bloklar arası PAYLAŞILAN, nötr doğrulama yardımcıları — bir bloğun bir
// diğerine bağımlı olması DEĞİL, hepsinin aynı alt yapıya (bu dosyaya)
// bağımlı olmasıdır. `lib/design-system/tokens.ts`'e nasıl her blok/tema
// bağımlıysa, doğrulama birincil ilkeleri de aynı şekilde tek yerden gelir.
//
// Tüm fonksiyonlar `unknown` girdi alır, ASLA fırlatmaz (throw etmez) —
// geçersiz/eksik değer sessizce fallback'e döner ve `issues` dizisine
// insan-okunur bir kayıt eklenir. Sunucu tarafı yazma işlemleri bu şekilde
// hiçbir zaman kötü biçimlendirilmiş içerik yüzünden çökme riskiyle
// karşılaşmaz (mevcut "sunucu her şeyi yeniden doğrular" ilkesiyle tutarlı).

export function readString(
  value: unknown,
  fallback: string,
  path: string,
  issues: BuilderValidationIssue[],
  options?: { maxLength?: number },
): string {
  if (typeof value !== "string") {
    issues.push({ path, message: "Metin bekleniyor, varsayılan değer kullanıldı." });
    return fallback;
  }

  const trimmed = value.trim();
  const maxLength = options?.maxLength;

  if (maxLength && trimmed.length > maxLength) {
    issues.push({ path, message: `En fazla ${maxLength} karakter olmalı, kısaltıldı.` });
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
}

export function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
  path: string,
  issues: BuilderValidationIssue[],
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }

  issues.push({ path, message: `Geçersiz değer, izin verilenler: ${allowed.join(", ")}.` });
  return fallback;
}

export function readNumber(
  value: unknown,
  fallback: number,
  path: string,
  issues: BuilderValidationIssue[],
  options?: { min?: number; max?: number },
): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path, message: "Sayı bekleniyor, varsayılan değer kullanıldı." });
  }

  const min = options?.min;
  const max = options?.max;
  let clamped = numeric;

  if (typeof min === "number" && clamped < min) {
    clamped = min;
    issues.push({ path, message: `En az ${min} olmalı, sınırlandırıldı.` });
  }

  if (typeof max === "number" && clamped > max) {
    clamped = max;
    issues.push({ path, message: `En fazla ${max} olmalı, sınırlandırıldı.` });
  }

  return clamped;
}

export function readBoolean(
  value: unknown,
  fallback: boolean,
): boolean {
  return typeof value === "boolean" ? value : fallback;
}

// Yalnızca http(s)/mailto/tel şemalarına ve site-içi göreli yollara izin
// verir — mimari analiz raporunun "K" (Güvenlik) bölümündeki "external link
// doğrulama" önerisinin ilk gerçek uygulaması. `javascript:` gibi tehlikeli
// şemalar sessizce reddedilip "#" ile değiştirilir.
const SAFE_HREF_PATTERN = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

export function readHref(
  value: unknown,
  fallback: string,
  path: string,
  issues: BuilderValidationIssue[],
): string {
  const candidate = readString(value, fallback, path, issues);

  if (candidate === "" || SAFE_HREF_PATTERN.test(candidate)) {
    return candidate;
  }

  issues.push({ path, message: "Güvenli olmayan bağlantı şeması reddedildi." });
  return fallback;
}

// Görsel kaynakları için AYRI (readHref'ten daha dar) bir kural: yalnızca
// http(s) ve site-içi göreli yollara izin verilir — `tel:`/`mailto:`/`#anchor`
// gibi readHref için geçerli olan şemalar bir <img src> için anlamsızdır ve
// kabul edilmez. Boş değer "görsel yok" durumu olarak kabul edilir (Fallback
// UI devreye girer), hataya çevrilmez.
const SAFE_IMAGE_SRC_PATTERN = /^(https?:\/\/|\/)/i;

export function readImageSrc(
  value: unknown,
  fallback: string,
  path: string,
  issues: BuilderValidationIssue[],
): string {
  const candidate = readString(value, fallback, path, issues, { maxLength: 2048 });

  if (candidate === "" || SAFE_IMAGE_SRC_PATTERN.test(candidate)) {
    return candidate;
  }

  issues.push({ path, message: "Güvenli olmayan görsel kaynağı reddedildi." });
  return fallback;
}

// Video embed URL whitelist — yalnızca bilinen, privacy-friendly gömme
// noktaları kabul edilir. Bu bilerek bir "genel iframe src" doğrulayıcısı
// DEĞİLDİR: keyfi bir domain'e iframe açmak (arbitrary embed) tek başına bir
// XSS açığı olmasa bile, tenant'ın public sitesine üçüncü taraf bir sayfayı
// clickjacking/tracking riskiyle gömme imkanı verir. Bilinmeyen host ->
// reddedilip boş string ("video yok") döner, throw edilmez.
const EMBED_HOST_ALLOWLIST = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
]);

export function readEmbedUrl(
  value: unknown,
  fallback: string,
  path: string,
  issues: BuilderValidationIssue[],
): string {
  const candidate = readString(value, fallback, path, issues, { maxLength: 2048 });

  if (candidate === "") {
    return candidate;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    issues.push({ path, message: "Geçersiz video bağlantısı, video kaldırıldı." });
    return "";
  }

  if (parsed.protocol !== "https:" || !EMBED_HOST_ALLOWLIST.has(parsed.hostname.toLowerCase())) {
    issues.push({ path, message: "Yalnızca YouTube veya Vimeo gömme bağlantılarına izin verilir." });
    return "";
  }

  return candidate;
}

// Bloklar arası PAYLAŞILAN dizi (repeater) doğrulayıcısı — slaytlar, galeri
// görselleri, SSS soruları, yorumlar, istatistikler ve rozetler gibi tüm
// "öğe listesi" alanları AYNI iskeleti kullanır: dizi değilse fallback'e
// düş, maxItems'ı aşan öğeler kırpılır, her öğe kendi mapItem() doğrulayıcısı
// ile (kendi issues path'iyle) ayrı ayrı doğrulanır. `mapItem` throw ETMEMELİ
// — her blok kendi alan bazlı readString/readNumber/... çağrılarını kullanıp
// issues dizisine ekleme yapar, tıpkı content/style alanları gibi.
export function readArray<T>(
  value: unknown,
  path: string,
  issues: BuilderValidationIssue[],
  options: {
    maxItems: number;
    mapItem: (raw: unknown, index: number, itemIssues: BuilderValidationIssue[]) => T;
  },
): T[] {
  if (!Array.isArray(value)) {
    if (value !== undefined) {
      issues.push({ path, message: "Liste bekleniyor, boş liste kullanıldı." });
    }
    return [];
  }

  const overflow = value.length > options.maxItems;
  const capped = value.slice(0, options.maxItems);

  if (overflow) {
    issues.push({ path, message: `En fazla ${options.maxItems} öğe olmalı, fazlalar kırpıldı.` });
  }

  return capped.map((raw, index) => options.mapItem(raw, index, issues));
}
