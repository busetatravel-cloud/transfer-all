export type SupportedLanguageCode =
  | "tr"
  | "en"
  | "ru"
  | "uk"
  | "es"
  | "fr"
  | "de"
  | "ko"
  | "zh"
  | "bg"
  | "ro"
  | "el"
  | "hi"
  | "id"
  | "it"
  | "ja"
  | "ms"
  | "nl"
  | "no"
  | "pl"
  | "pt"
  | "sr"
  | "sv"
  | "ar"
  | "fa"
  | "bs"
  | "sq";

export type SupportedLanguage = {
  code: SupportedLanguageCode;
  label: string;
  nativeLabel: string;
  direction: "ltr" | "rtl";
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "tr", label: "Türkçe", nativeLabel: "Türkçe", direction: "ltr" },
  { code: "en", label: "İngilizce", nativeLabel: "English", direction: "ltr" },
  { code: "ru", label: "Rusça", nativeLabel: "Русский", direction: "ltr" },
  { code: "uk", label: "Ukraynaca", nativeLabel: "Українська", direction: "ltr" },
  { code: "es", label: "İspanyolca", nativeLabel: "Español", direction: "ltr" },
  { code: "fr", label: "Fransızca", nativeLabel: "Français", direction: "ltr" },
  { code: "de", label: "Almanca", nativeLabel: "Deutsch", direction: "ltr" },
  { code: "ko", label: "Korece", nativeLabel: "한국어", direction: "ltr" },
  { code: "zh", label: "Çince", nativeLabel: "中文", direction: "ltr" },
  { code: "bg", label: "Bulgarca", nativeLabel: "Български", direction: "ltr" },
  { code: "ro", label: "Rumence", nativeLabel: "Română", direction: "ltr" },
  { code: "el", label: "Yunanca", nativeLabel: "Ελληνικά", direction: "ltr" },
  { code: "hi", label: "Hintçe", nativeLabel: "हिन्दी", direction: "ltr" },
  { code: "id", label: "Endonezce", nativeLabel: "Bahasa Indonesia", direction: "ltr" },
  { code: "it", label: "İtalyanca", nativeLabel: "Italiano", direction: "ltr" },
  { code: "ja", label: "Japonca", nativeLabel: "日本語", direction: "ltr" },
  { code: "ms", label: "Malayca", nativeLabel: "Bahasa Melayu", direction: "ltr" },
  { code: "nl", label: "Flemenkçe", nativeLabel: "Nederlands", direction: "ltr" },
  { code: "no", label: "Norveççe", nativeLabel: "Norsk", direction: "ltr" },
  { code: "pl", label: "Lehçe", nativeLabel: "Polski", direction: "ltr" },
  { code: "pt", label: "Portekizce", nativeLabel: "Português", direction: "ltr" },
  { code: "sr", label: "Sırpça", nativeLabel: "Српски", direction: "ltr" },
  { code: "sv", label: "İsveççe", nativeLabel: "Svenska", direction: "ltr" },
  { code: "ar", label: "Arapça", nativeLabel: "العربية", direction: "rtl" },
  { code: "fa", label: "Farsça", nativeLabel: "فارسی", direction: "rtl" },
  { code: "bs", label: "Boşnakça", nativeLabel: "Bosanski", direction: "ltr" },
  { code: "sq", label: "Arnavutça", nativeLabel: "Shqip", direction: "ltr" },
];

const SUPPORTED_LANGUAGE_SET = new Set<SupportedLanguageCode>(
  SUPPORTED_LANGUAGES.map((language) => language.code),
);

const RTL_LANGUAGE_SET = new Set<SupportedLanguageCode>(["ar", "fa"]);

export function isSupportedLanguageCode(value: string | null | undefined): value is SupportedLanguageCode {
  return typeof value === "string" && SUPPORTED_LANGUAGE_SET.has(value.toLowerCase() as SupportedLanguageCode);
}

export function normalizeLanguageCode(
  value: string | null | undefined,
): SupportedLanguageCode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return isSupportedLanguageCode(normalized) ? normalized : null;
}

export function getLanguageByCode(code: string | null | undefined) {
  const normalized = normalizeLanguageCode(code);
  if (!normalized) {
    return null;
  }

  return SUPPORTED_LANGUAGES.find((language) => language.code === normalized) ?? null;
}

export function isRTLLanguage(code: string | null | undefined) {
  const normalized = normalizeLanguageCode(code);
  return normalized ? RTL_LANGUAGE_SET.has(normalized) : false;
}

export function getLanguageLabel(code: string | null | undefined) {
  const language = getLanguageByCode(code);
  return language?.label ?? String(code ?? "").trim().toUpperCase();
}

