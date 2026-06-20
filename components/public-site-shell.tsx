/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { ReactNode } from "react";
import type { BusinessRecord } from "@/lib/business";
import { MEDIA_PLACEHOLDER_SRC } from "@/lib/media";
import { joinPublicPath } from "@/lib/public-path";
import { PublicAnalyticsTracker } from "@/components/public-analytics-tracker";
import {
  SUPPORTED_LANGUAGES,
  isRTLLanguage,
  type SupportedLanguageCode,
} from "@/lib/languages";
import type { PublicCopy } from "@/lib/public-copy";

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

export function PublicSiteShell({
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

  return (
    <div
      dir={rtl ? "rtl" : "ltr"}
      lang={locale}
      className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f1f5f9_100%)] text-slate-950"
    >
      {trackAnalytics ? (
        <PublicAnalyticsTracker businessId={business.id} enabled />
      ) : null}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href={localizedHref("/")} className="text-lg font-semibold tracking-tight">
            {business.name}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <nav className="flex flex-wrap gap-2 text-sm text-slate-600">
              {baseNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={localizedHref(item.href)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:text-slate-950"
                >
                  {navCopy?.[item.key] ?? item.key}
                </Link>
              ))}
            </nav>
            {availableLocales.length ? (
              <div className="flex flex-wrap gap-2">
                {availableLocales.map((item) => {
                  const active = item.code === locale;
                  const href = `${currentUrl}${currentUrl.includes("?") ? "&" : "?"}lang=${encodeURIComponent(item.code)}`;
                  return (
                    <Link
                      key={item.code}
                      href={href}
                      className={[
                        "rounded-full border px-3 py-2 text-xs font-semibold transition",
                        active
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
                      ].join(" ")}
                    >
                      {item.nativeLabel}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
          <p>{business.domain ?? "Custom domain"}</p>
          <p>{business.email}</p>
        </div>
      </footer>
    </div>
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-slate-600">{description}</p>
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
    <article className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
      <div className="aspect-[16/10] overflow-hidden bg-slate-100">
        <img
          alt={imageAlt || title}
          className="h-full w-full object-cover"
          loading="lazy"
          src={imageSrc?.trim() || MEDIA_PLACEHOLDER_SRC}
        />
      </div>
      <div className="grid gap-3 p-5">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="text-sm leading-7 text-slate-600">{description}</p>
      </div>
    </article>
  );

  if (!href) {
    return card;
  }

  return <Link href={href}>{card}</Link>;
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
    <div className={`overflow-hidden rounded-[28px] border border-slate-200 bg-slate-100 ${className}`}>
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
    <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-5 py-6 text-sm text-slate-500">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 leading-7">{description}</p>
    </div>
  );
}

