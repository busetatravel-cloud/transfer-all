import type { ReactNode } from "react";
import type { ButtonSizeToken, CardPaddingToken } from "@/lib/design-system/tokens";

// Website Builder bloklarının PAYLAŞTIĞI tek ortak görsel kelime dağarcığı.
// Bloklar birbirine değil, buraya bağımlıdır — bu dosya "Design System
// Foundation" (Faz 1) token'larını gerçek DOM'a dönüştüren tek yerdir.
// Yeni bir blok eklerken burada bir şey DEĞİŞTİRMEK gerekmez, yalnızca bu
// bileşenler import edilip kullanılır.
//
// Tamamen Server Component'tir (hiçbir "use client" yok) — SEO/SSR
// disiplini (mevcut public site sayfalarıyla birebir aynı) korunur.

export function BuilderContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[var(--ps-container-content)] px-4 ${className}`}>
      {children}
    </div>
  );
}

const HEADING_TAGS = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
} as const;

export function BuilderHeading({
  level,
  size,
  children,
  className = "",
}: {
  level: "h1" | "h2" | "h3";
  size: "3xl" | "4xl" | "5xl" | "6xl" | "2xl" | "xl";
  children: ReactNode;
  className?: string;
}) {
  const Tag = HEADING_TAGS[level];

  return (
    <Tag
      className={`font-semibold tracking-tight ${className}`}
      style={{
        fontSize: `var(--ps-font-size-${size})`,
        lineHeight: `var(--ps-line-height-${size})`,
      }}
    >
      {children}
    </Tag>
  );
}

export function BuilderText({
  size = "base",
  children,
  className = "",
}: {
  size?: "sm" | "base" | "lg";
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={className}
      style={{
        fontSize: `var(--ps-font-size-${size})`,
        lineHeight: `var(--ps-line-height-${size})`,
      }}
    >
      {children}
    </p>
  );
}

export function BuilderButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: ButtonSizeToken;
  className?: string;
}) {
  const toneClass =
    variant === "primary"
      ? "bg-[var(--ps-primary)] text-[var(--ps-background)] hover:opacity-90"
      : "border border-[var(--ps-secondary)] bg-transparent text-[var(--ps-text)] hover:bg-[var(--ps-surface)]";
  // ps-cta-primary/ps-cta-secondary: mevcut public site CSS'indeki
  // [data-ps-theme="luxury"] .ps-cta-* kurallarinin (altin vurgu, hover
  // rengi) builder butonlarina da uygulanmasini saglayan kanca sinifi.
  // Legacy hardcoded hero de AYNI iki class'i primary/secondary buton icin
  // kullanir — burada birebir ayni esleme korunuyor. Modern temada bu
  // class'lar icin hicbir CSS kurali tanimli degildir, bu yuzden Modern
  // gorunumde sifir etkisi vardir.
  const themeMarkerClass = variant === "primary" ? "ps-cta-primary" : "ps-cta-secondary";

  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center font-semibold transition ${toneClass} ${themeMarkerClass} ${className}`}
      style={{
        height: `var(--ps-button-height-${size})`,
        paddingLeft: `var(--ps-button-padding-x-${size})`,
        paddingRight: `var(--ps-button-padding-x-${size})`,
        fontSize: `var(--ps-button-font-size-${size})`,
        borderRadius: "var(--ps-radius)",
        transitionDuration: "var(--ps-transition-base)",
        transitionTimingFunction: "var(--ps-easing-standard)",
      }}
    >
      {children}
    </a>
  );
}

export function BuilderCard({
  children,
  padding = "md",
  className = "",
}: {
  children: ReactNode;
  padding?: CardPaddingToken;
  className?: string;
}) {
  return (
    <article
      className={`border border-[color-mix(in_srgb,var(--ps-secondary)_25%,transparent)] bg-[var(--ps-surface)] text-[var(--ps-text)] ${className}`}
      style={{
        padding: `var(--ps-card-padding-${padding})`,
        borderRadius: "var(--ps-radius)",
        boxShadow: "var(--ps-shadow)",
      }}
    >
      {children}
    </article>
  );
}

// Faz 14 — görsel taşıyan yeni bloklar (Hero Slider/Gallery/Vehicle-Route
// Showcase/Video poster/Partners) için paylaşılan görsel ilkesi.
//
// Bilerek `next/image` KULLANILMAZ: bu repo'da (app/, components/) hiçbir
// yerde `next/image` kullanılmıyor — mevcut tek görsel deseni (bkz.
// components/public-site-shell.tsx) düz `<img loading="lazy">`'dır. Next
// Image'a geçmek `next.config.ts`'e remotePatterns eklemeyi gerektirir ki bu,
// bu fazın kapsamı olan "registry/render/preview/inspector" katmanlarının
// dışında, paylaşılan bir altyapı değişikliğidir. Bunun yerine CLS'i önlemek
// için aynı "aspect-ratio sarmalayıcı + object-cover" deseni + `decoding=
// "async"` ile lazy-loading burada da birebir korunur.
export function BuilderImage({
  src,
  alt,
  aspectRatio = "16/9",
  className = "",
  fit = "cover",
}: {
  src: string;
  alt: string;
  aspectRatio?: string;
  className?: string;
  fit?: "cover" | "contain";
}) {
  if (!src.trim()) {
    return (
      <div
        aria-hidden="true"
        className={`flex items-center justify-center border border-dashed border-[color-mix(in_srgb,var(--ps-secondary)_35%,transparent)] bg-[var(--ps-surface)] ${className}`}
        style={{ aspectRatio }}
      >
        <span style={{ fontSize: "var(--ps-font-size-sm)", opacity: 0.5 }}>Görsel yok</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${className}`} style={{ aspectRatio }}>
      <img
        alt={alt}
        className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover"}`}
        decoding="async"
        loading="lazy"
        src={src}
      />
    </div>
  );
}

// Bir bloğun içeriği geçersiz/eksik geldiğinde (ör. henüz hiç doldurulmamış
// yeni bir section) gösterilecek, tema token'larıyla uyumlu boş durum.
export function BuilderFallback({ reason }: { reason?: string }) {
  return (
    <div
      className="border border-dashed border-[color-mix(in_srgb,var(--ps-secondary)_35%,transparent)] bg-[var(--ps-surface)] text-center text-[var(--ps-text)]"
      style={{
        padding: "var(--ps-space-xl)",
        borderRadius: "var(--ps-radius)",
      }}
    >
      <p style={{ fontSize: "var(--ps-font-size-sm)", opacity: 0.7 }}>
        {reason || "Bu blok için henüz içerik girilmedi."}
      </p>
    </div>
  );
}
