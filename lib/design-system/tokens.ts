import type { ThemeBorderRadiusToken, ThemeShadowToken } from "@/lib/theme-types";

// Website Builder'ın TÜM blokları, temaları ve admin bileşenleri bu dosyadaki
// sabit ölçeklerden beslenir. Amaç: hangi blok/tema eklenirse eklensin aynı
// boşluk/tipografi/köşe/gölge ritmini paylaşması — "sonradan eklenen hiçbir
// blok veya tema birbirinden farklı hissettirmesin" ilkesi.
//
// Bu dosyadaki değerler kod sabitleridir (business_theme_settings'ten OKUNMAZ).
// Tenant'a özel olan yalnızca RENK/FONT SEÇİMİ ve bu ölçeklerden HANGİ
// ANAHTARIN seçildiğidir (örn. borderRadius: "lg") — ölçeğin kendisi (lg'nin
// kaç piksel olduğu) her zaman buradan gelir, tek kaynaktan yönetilir.

export const SPACING_SCALE = {
  none: "0rem",
  xs: "0.5rem", // 8px
  sm: "0.75rem", // 12px
  md: "1rem", // 16px
  lg: "1.5rem", // 24px
  xl: "2rem", // 32px
  "2xl": "3rem", // 48px
  "3xl": "4rem", // 64px
  "4xl": "6rem", // 96px
} as const;

export type SpacingToken = keyof typeof SPACING_SCALE;

// font-size + line-height çiftleri birlikte değişir; ayrı ayrı yönetilmez —
// böylece herhangi bir blok "text-lg" seçtiğinde satır yüksekliği otomatik
// doğru gelir, ayrıca ayarlanması gerekmez.
export const TYPOGRAPHY_SCALE = {
  xs: { fontSize: "0.75rem", lineHeight: "1.1rem" },
  sm: { fontSize: "0.875rem", lineHeight: "1.35rem" },
  base: { fontSize: "1rem", lineHeight: "1.6rem" },
  lg: { fontSize: "1.125rem", lineHeight: "1.75rem" },
  xl: { fontSize: "1.25rem", lineHeight: "1.85rem" },
  "2xl": { fontSize: "1.5rem", lineHeight: "2rem" },
  "3xl": { fontSize: "1.875rem", lineHeight: "2.35rem" },
  "4xl": { fontSize: "2.25rem", lineHeight: "2.6rem" },
  "5xl": { fontSize: "3rem", lineHeight: "3.4rem" },
  "6xl": { fontSize: "3.75rem", lineHeight: "4.1rem" },
} as const;

export type TypographyToken = keyof typeof TYPOGRAPHY_SCALE;

// "content" değeri, PublicSiteShell/PanelSection genelinde zaten kullanılan
// max-w-6xl (72rem/1152px) ile bilinçli olarak birebir aynıdır — Design System
// mevcut gerçek düzeni tanımlıyor, ondan sapan yeni bir değer icat etmiyor.
export const CONTAINER_WIDTHS = {
  sm: "40rem", // 640px
  md: "48rem", // 768px
  lg: "64rem", // 1024px
  content: "72rem", // 1152px — mevcut max-w-6xl ile aynı
  xl: "80rem", // 1280px
} as const;

export type ContainerWidthToken = keyof typeof CONTAINER_WIDTHS;

export const BORDER_RADIUS_SCALE: Record<ThemeBorderRadiusToken, string> = {
  none: "0px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  full: "9999px",
};

export const SHADOW_SCALE: Record<ThemeShadowToken, string> = {
  none: "none",
  soft: "0 20px 60px rgba(15, 23, 42, 0.10)",
  medium: "0 28px 80px rgba(15, 23, 42, 0.16)",
  strong: "0 32px 100px rgba(15, 23, 42, 0.24)",
};

// Buton yükseklik/dolgu ölçeği. "md" mevcut public site genelinde zaten
// kullanılan h-11 (44px) ile birebir aynıdır — yeni bir buton yüksekliği
// icat edilmiyor, mevcut fiili standart kayıt altına alınıyor.
export const BUTTON_SIZE_SCALE = {
  sm: { height: "2.25rem", paddingX: "0.75rem", fontSize: TYPOGRAPHY_SCALE.sm.fontSize },
  md: { height: "2.75rem", paddingX: "1rem", fontSize: TYPOGRAPHY_SCALE.sm.fontSize },
  lg: { height: "3.25rem", paddingX: "1.5rem", fontSize: TYPOGRAPHY_SCALE.base.fontSize },
} as const;

export type ButtonSizeToken = keyof typeof BUTTON_SIZE_SCALE;

export const CARD_PADDING_SCALE = {
  sm: SPACING_SCALE.md,
  md: SPACING_SCALE.lg,
  lg: SPACING_SCALE.xl,
} as const;

export type CardPaddingToken = keyof typeof CARD_PADDING_SCALE;

export const TRANSITION_SCALE = {
  fast: "150ms",
  base: "250ms",
  slow: "400ms",
} as const;

export type TransitionToken = keyof typeof TRANSITION_SCALE;

export const EASING_SCALE = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

export type EasingToken = keyof typeof EASING_SCALE;

// Live Preview (Desktop/Tablet/Mobile) ve responsive section override'ları
// AYNI üç değeri kullanır — iframe genişlikleri ile CSS breakpoint'leri
// birbirinden asla sapmaz.
export const BREAKPOINTS = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
} as const;

export type BreakpointToken = keyof typeof BREAKPOINTS;
