import type { ThemeBorderRadiusToken, ThemeSettings, ThemeShadowToken } from "@/lib/theme-types";

const BORDER_RADIUS_VALUES: Record<ThemeBorderRadiusToken, string> = {
  none: "0px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  full: "9999px",
};

const SHADOW_VALUES: Record<ThemeShadowToken, string> = {
  none: "none",
  soft: "0 20px 60px rgba(15, 23, 42, 0.10)",
  medium: "0 28px 80px rgba(15, 23, 42, 0.16)",
  strong: "0 32px 100px rgba(15, 23, 42, 0.24)",
};

// primaryColor/secondaryColor/backgroundColor/surfaceColor/textColor/fontFamily DB'den
// gelen ham metinlerdir ve doğrudan bir inline style değeri olarak kullanılır. ";", "{", "}"
// karakterleri CSS deklarasyon/blok sınırlayıcısı olduğu için (örn. "red; } body{display:none}")
// bu karakterler temizlenmeden geçirilirse aynı elemanın style özniteliğine yeni bir
// deklarasyon enjekte edilebilir. "<"/">" ek bir HTML-taraflı önlemdir. Renk/font
// söz diziminde geçerli olan tırnak, virgül, parantez, # gibi karakterlere dokunulmaz.
function sanitizeCssValue(value: string): string {
  return value.replace(/[;{}<>]/g, "").trim();
}

// Public site'a özel CSS custom property isim alanı ("ps" = public site).
// Admin panelinin app/globals.css'teki --brand/--accent/--surface gibi
// değişkenleriyle kasıtlı olarak hiçbir isim çakışması yok.
export function buildThemeCssVariables(settings: ThemeSettings): Record<string, string> {
  return {
    "--ps-primary": sanitizeCssValue(settings.primaryColor),
    "--ps-secondary": sanitizeCssValue(settings.secondaryColor),
    "--ps-background": sanitizeCssValue(settings.backgroundColor),
    "--ps-surface": sanitizeCssValue(settings.surfaceColor),
    "--ps-text": sanitizeCssValue(settings.textColor),
    "--ps-radius": BORDER_RADIUS_VALUES[settings.borderRadius] ?? BORDER_RADIUS_VALUES.lg,
    "--ps-shadow": SHADOW_VALUES[settings.shadow] ?? SHADOW_VALUES.soft,
    "--ps-font": sanitizeCssValue(settings.fontFamily),
  };
}
