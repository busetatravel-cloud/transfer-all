import type { ThemeSettings } from "@/lib/theme-types";
import {
  BORDER_RADIUS_SCALE,
  BUTTON_SIZE_SCALE,
  CARD_PADDING_SCALE,
  CONTAINER_WIDTHS,
  EASING_SCALE,
  SHADOW_SCALE,
  SPACING_SCALE,
  TRANSITION_SCALE,
  TYPOGRAPHY_SCALE,
} from "@/lib/design-system/tokens";

const BORDER_RADIUS_VALUES = BORDER_RADIUS_SCALE;
const SHADOW_VALUES = SHADOW_SCALE;

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

// Design System Foundation — TÜM temalarda/bloklarda sabit kalan ölçekler.
// Kod sabitlerinden üretildiği için (DB'den gelmediği için) sanitizeCssValue
// gerekmez. Tema değişse de blok değişse de bu değerler AYNI kalır; ortak
// ritim buradan gelir. ThemeStyleProvider bunu buildThemeCssVariables ile
// birleştirip tek bir style objesi olarak public site köküne uygular.
export function buildDesignSystemCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(SPACING_SCALE)) {
    vars[`--ps-space-${key}`] = value;
  }

  for (const [key, value] of Object.entries(TYPOGRAPHY_SCALE)) {
    vars[`--ps-font-size-${key}`] = value.fontSize;
    vars[`--ps-line-height-${key}`] = value.lineHeight;
  }

  for (const [key, value] of Object.entries(CONTAINER_WIDTHS)) {
    vars[`--ps-container-${key}`] = value;
  }

  for (const [key, value] of Object.entries(BUTTON_SIZE_SCALE)) {
    vars[`--ps-button-height-${key}`] = value.height;
    vars[`--ps-button-padding-x-${key}`] = value.paddingX;
    vars[`--ps-button-font-size-${key}`] = value.fontSize;
  }

  for (const [key, value] of Object.entries(CARD_PADDING_SCALE)) {
    vars[`--ps-card-padding-${key}`] = value;
  }

  for (const [key, value] of Object.entries(TRANSITION_SCALE)) {
    vars[`--ps-transition-${key}`] = value;
  }

  for (const [key, value] of Object.entries(EASING_SCALE)) {
    vars[`--ps-easing-${key}`] = value;
  }

  return vars;
}
