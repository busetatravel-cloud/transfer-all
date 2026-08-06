/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { ReactNode } from "react";
import type { BusinessRecord } from "@/lib/business";
import { MEDIA_PLACEHOLDER_SRC } from "@/lib/media";
import { joinPublicPath } from "@/lib/public-path";
import { PublicAnalyticsTracker } from "@/components/public-analytics-tracker";
import { MobileNav } from "@/components/public-site-mobile-nav";
import { ThemeStyleProvider } from "@/components/theme/theme-style-provider";
import { getBusinessThemeSettings } from "@/lib/theme-settings";
import {
  SUPPORTED_LANGUAGES,
  isRTLLanguage,
  type SupportedLanguageCode,
} from "@/lib/languages";
import type { PublicCopy } from "@/lib/public-copy";

export function toWhatsAppDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

const baseNavItems = [
  { href: "/", key: "home" },
  { href: "/services", key: "services" },
  { href: "/vehicles", key: "vehicles" },
  { href: "/routes", key: "routes" },
  { href: "/blog", key: "blog" },
  { href: "/contact", key: "contact" },
  { href: "/quote", key: "quote" },
  { href: "/booking", key: "booking" },
] as const;

export async function PublicSiteShell({
  business,
  children,
  basePath = "",
  trackAnalytics = true,
  locale = "tr",
  locales = [],
  currentPath = "/",
  copy,
}: {
  business: BusinessRecord;
  children: ReactNode;
  basePath?: string;
  trackAnalytics?: boolean;
  locale?: SupportedLanguageCode | string;
  locales?: Array<{ code: string; name?: string }>;
  currentPath?: string;
  copy?: PublicCopy;
}) {
  const themeSettings = await getBusinessThemeSettings(business.id);
  const buildHref = (href: string) => joinPublicPath(basePath, href);
  const currentRoute = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
  const currentUrl = buildHref(currentRoute);
  const localizedHref = (href: string) => {
    const baseHref = buildHref(href);
    return `${baseHref}${baseHref.includes("?") ? "&" : "?"}lang=${encodeURIComponent(String(locale))}`;
  };
  const rtl = isRTLLanguage(locale);
  const availableLocales = locales.length
    ? locales
        .map((item) => {
          const language = SUPPORTED_LANGUAGES.find((entry) => entry.code === item.code.toLowerCase());
          return language ? { ...language, displayName: item.name || language.label } : null;
        })
        .filter((item): item is { code: SupportedLanguageCode; label: string; nativeLabel: string; direction: "ltr" | "rtl"; displayName: string } => Boolean(item))
    : [];
  const navCopy = copy?.menus;

  // Faz 15 — 8 eşit ağırlıklı pill yerine: Home/Services/Vehicles/Routes/
  // Blog/Contact birincil yatay nav, Booking (rezervasyon takip) küçük bir
  // metin linki, Quote ("Teklif Al") ise vurgulu birincil CTA butonu olarak
  // ayrıştırıldı — mobilde hamburger panelinde tüm linkler yine tam listede.
  const primaryNavKeys: ReadonlyArray<(typeof baseNavItems)[number]["key"]> = [
    "home",
    "services",
    "vehicles",
    "routes",
    "blog",
    "contact",
  ];
  const resolvedNavItems = baseNavItems
    .filter((item) => primaryNavKeys.includes(item.key))
    .map((item) => {
      const href = localizedHref(item.href);
      const active = item.href === "/" ? currentRoute === "/" : currentRoute.startsWith(item.href);
      return { href, label: navCopy?.[item.key] ?? item.key, active };
    });
  const bookingItem = baseNavItems.find((item) => item.key === "booking");
  const bookingHref = bookingItem ? localizedHref(bookingItem.href) : null;
  const bookingActive = bookingItem ? currentRoute.startsWith(bookingItem.href) : false;
  const quoteHref = localizedHref("/quote");
  const quoteLabel = navCopy?.quote ?? "Teklif Al";
  const whatsappDigits = business.whatsapp ? toWhatsAppDigits(business.whatsapp) : "";

  return (
    <ThemeStyleProvider
      settings={themeSettings}
      dir={rtl ? "rtl" : "ltr"}
      lang={locale}
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f1f5f9_100%)] text-slate-950"
    >
      {trackAnalytics ? (
        <PublicAnalyticsTracker businessId={business.id} enabled />
      ) : null}
      <header className="ps-header sticky top-0 z-20 border-b border-[color-mix(in_srgb,var(--ps-secondary)_20%,transparent)] bg-[color-mix(in_srgb,var(--ps-surface)_92%,transparent)] backdrop-blur">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
          <Link href={localizedHref("/")} className="ps-brand min-w-0 truncate text-lg font-semibold tracking-tight">
            {business.name}
          </Link>

          <nav aria-label="Ana navigasyon" className="hidden items-center gap-1 lg:flex">
            {resolvedNavItems.map((item) => (
              <Link
                aria-current={item.active ? "page" : undefined}
                className={`ps-nav-link ps-underline-hover rounded-full px-3 py-2 text-sm font-medium transition ${
                  item.active ? "text-[var(--ps-primary)]" : "text-[var(--ps-text)] opacity-75 hover:opacity-100"
                }`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
            {bookingHref ? (
              <Link
                aria-current={bookingActive ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  bookingActive ? "text-[var(--ps-primary)]" : "text-[var(--ps-text)] opacity-60 hover:opacity-100"
                }`}
                href={bookingHref}
              >
                {navCopy?.booking ?? "Rezervasyon"}
              </Link>
            ) : null}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {business.phone ? (
              <a
                aria-label="Telefonla ara"
                className="ps-cta-phone !w-11 !px-0"
                href={`tel:${business.phone}`}
              >
                <PhoneIcon />
              </a>
            ) : null}
            {whatsappDigits ? (
              <a
                aria-label="WhatsApp'tan yaz"
                className="ps-cta-whatsapp !w-11 !px-0"
                href={`https://wa.me/${whatsappDigits}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <WhatsAppIcon />
              </a>
            ) : null}
            {availableLocales.length ? (
              <div className="flex flex-wrap gap-1">
                {availableLocales.map((item) => {
                  const active = item.code === locale;
                  const href = `${currentUrl}${currentUrl.includes("?") ? "&" : "?"}lang=${encodeURIComponent(item.code)}`;
                  return (
                    <Link
                      key={item.code}
                      href={href}
                      className={[
                        "rounded-full border px-2.5 py-1.5 text-xs font-semibold transition",
                        active
                          ? "border-[var(--ps-primary)] bg-[var(--ps-primary)] text-[var(--ps-background)]"
                          : "border-[color-mix(in_srgb,var(--ps-secondary)_30%,transparent)] text-[var(--ps-text)] opacity-70 hover:opacity-100",
                      ].join(" ")}
                    >
                      {item.nativeLabel}
                    </Link>
                  );
                })}
              </div>
            ) : null}
            <Link className="ps-cta-primary" href={quoteHref}>
              {quoteLabel}
            </Link>
          </div>

          <MobileNav
            ctaHref={quoteHref}
            ctaLabel={quoteLabel}
            items={[
              ...resolvedNavItems,
              ...(bookingHref ? [{ href: bookingHref, label: navCopy?.booking ?? "Rezervasyon", active: bookingActive }] : []),
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

      <PublicSiteFooter business={business} localizedHref={localizedHref} navCopy={navCopy} quoteHref={quoteHref} whatsappDigits={whatsappDigits} />
    </ThemeStyleProvider>
  );
}

export function PanelSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
      ) : null}
      <div className="grid gap-3">
        <h1 className="ps-heading text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description ? (
          <p className="ps-subtext max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function ContentCard({
  title,
  description,
  href,
  imageSrc,
  imageAlt,
}: {
  title: string;
  description: string;
  href?: string;
  imageSrc?: string | null;
  imageAlt?: string;
}) {
  const card = (
    <article className="ps-card ps-hover-lift overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
      <div className="ps-hover-zoom aspect-[16/10] bg-slate-100">
        <img
          alt={imageAlt || title}
          className="h-full w-full object-cover"
          loading="lazy"
          src={imageSrc?.trim() || MEDIA_PLACEHOLDER_SRC}
        />
      </div>
      <div className="ps-card-body grid gap-2 p-5">
        <h2 className="ps-card-title line-clamp-2 text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="ps-card-text line-clamp-3 text-sm leading-7 text-slate-600">{description}</p>
      </div>
    </article>
  );

  if (!href) {
    return card;
  }

  return (
    <Link className="block rounded-[24px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-primary)]" href={href}>
      {card}
    </Link>
  );
}

export function MediaFrame({
  imageSrc,
  imageAlt,
  label,
  className = "",
}: {
  imageSrc?: string | null;
  imageAlt: string;
  label?: string;
  className?: string;
}) {
  const source = imageSrc?.trim() || MEDIA_PLACEHOLDER_SRC;

  return (
    <div className={`ps-media-frame overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 ${className}`}>
      <div className="aspect-[4/3] w-full">
        <img alt={imageAlt} className="h-full w-full object-cover" loading="lazy" src={source} />
      </div>
      {label ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          {label}
        </div>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="ps-empty-state rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 leading-7">{description}</p>
    </div>
  );
}

// Faz 15 — services/vehicles/routes detay sayfalarındaki, ziyaretçiye
// tenant-izolasyonu implementasyon detayını anlatan geliştirici notunu
// ("Bu kayıt business sınırları içinde tutulur" vb.) değiştirir. Bunun
// yerine gerçekten faydalı, dönüşüm odaklı bir iletişim CTA'sı gösterir —
// gerçek business.phone/whatsapp verisiyle, form/submit mantığına dokunmadan.
export function DetailContactCta({
  business,
  quoteHref,
  title = "İlgileniyor musunuz?",
  description = "Detaylı bilgi ve fiyat teklifi için bize ulaşın, size en kısa sürede dönüş yapalım.",
}: {
  business: BusinessRecord;
  quoteHref: string;
  title?: string;
  description?: string;
}) {
  const whatsappDigits = business.whatsapp ? toWhatsAppDigits(business.whatsapp) : "";

  return (
    <div className="ps-card grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid gap-1">
        <p className="ps-card-title text-lg font-semibold tracking-tight">{title}</p>
        <p className="ps-card-text text-sm leading-6 opacity-70">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className="ps-cta-primary" href={quoteHref}>
          Teklif al
        </Link>
        {business.phone ? (
          <a className="ps-cta-phone" href={`tel:${business.phone}`}>
            <PhoneIcon /> Ara
          </a>
        ) : null}
        {whatsappDigits ? (
          <a className="ps-cta-whatsapp" href={`https://wa.me/${whatsappDigits}`} rel="noopener noreferrer" target="_blank">
            <WhatsAppIcon /> WhatsApp
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function PhoneIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" fill="currentColor" height="18" viewBox="0 0 24 24" width="18">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.148.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347Z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.83.5 3.6 1.44 5.15L2 22l5.06-1.53a9.87 9.87 0 0 0 4.98 1.34h.004c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.85 15.75c-.246.694-1.436 1.363-1.982 1.446-.508.077-1.147.11-1.85-.117a13.5 13.5 0 0 1-1.03-.38c-1.813-.784-2.998-2.626-3.087-2.746-.09-.12-.735-.976-.735-1.862s.463-1.322.627-1.503c.164-.182.36-.227.48-.227h.343c.11 0 .258-.041.404.31.148.352.505 1.212.55 1.3.045.09.075.194.015.313-.06.12-.09.194-.18.298-.09.104-.19.232-.27.312-.09.09-.184.187-.079.365.104.178.464.766 1 1.24.687.611 1.266.8 1.444.89.178.09.282.075.386-.045.104-.12.446-.52.564-.699.12-.178.238-.148.402-.089.164.06 1.038.49 1.216.579.178.09.297.134.34.208.045.075.045.43-.2 1.123Z" />
    </svg>
  );
}

function PublicSiteFooter({
  business,
  localizedHref,
  navCopy,
  quoteHref,
  whatsappDigits,
}: {
  business: BusinessRecord;
  localizedHref: (href: string) => string;
  navCopy: PublicCopy["menus"] | undefined;
  quoteHref: string;
  whatsappDigits: string;
}) {
  const year = new Date().getFullYear();
  const quickLinks: Array<{ href: string; label: string }> = [
    { href: localizedHref("/"), label: navCopy?.home ?? "Ana sayfa" },
    { href: localizedHref("/services"), label: navCopy?.services ?? "Hizmetler" },
    { href: localizedHref("/vehicles"), label: navCopy?.vehicles ?? "Araçlar" },
    { href: localizedHref("/routes"), label: navCopy?.routes ?? "Rotalar" },
    { href: localizedHref("/blog"), label: navCopy?.blog ?? "Blog" },
  ];
  const supportLinks: Array<{ href: string; label: string }> = [
    { href: localizedHref("/contact"), label: navCopy?.contact ?? "İletişim" },
    { href: localizedHref("/booking"), label: navCopy?.booking ?? "Rezervasyon takibi" },
    { href: quoteHref, label: navCopy?.quote ?? "Teklif al" },
  ];

  return (
    <footer className="ps-footer border-t border-[color-mix(in_srgb,var(--ps-secondary)_20%,transparent)] bg-[var(--ps-surface)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="grid gap-3">
          <p className="ps-brand text-lg font-semibold tracking-tight">{business.name}</p>
          <p className="max-w-xs text-sm leading-6 opacity-70">
            {business.domain ?? "Custom domain"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {business.phone ? (
              <a className="ps-cta-phone !h-9 !px-3 text-xs" href={`tel:${business.phone}`}>
                <PhoneIcon /> {business.phone}
              </a>
            ) : null}
          </div>
          {whatsappDigits ? (
            <a
              className="ps-cta-whatsapp !h-9 w-fit !px-3 text-xs"
              href={`https://wa.me/${whatsappDigits}`}
              rel="noopener noreferrer"
              target="_blank"
            >
              <WhatsAppIcon /> WhatsApp
            </a>
          ) : null}
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Hızlı linkler</p>
          <nav className="grid gap-2 text-sm">
            {quickLinks.map((link) => (
              <Link className="ps-underline-hover w-fit opacity-80 transition hover:opacity-100" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">Destek</p>
          <nav className="grid gap-2 text-sm">
            {supportLinks.map((link) => (
              <Link className="ps-underline-hover w-fit opacity-80 transition hover:opacity-100" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="grid gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-60">İletişim</p>
          <div className="grid gap-1 text-sm opacity-80">
            <p>{business.email}</p>
            {business.phone ? <p>{business.phone}</p> : null}
          </div>
        </div>
      </div>

      <div className="border-t border-[color-mix(in_srgb,var(--ps-secondary)_15%,transparent)] px-4 py-5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 text-xs opacity-60 sm:flex-row">
          <p>&copy; {year} {business.name}. Tüm hakları saklıdır.</p>
          <p>{business.domain ?? ""}</p>
        </div>
      </div>
    </footer>
  );
}

