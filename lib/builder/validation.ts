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
