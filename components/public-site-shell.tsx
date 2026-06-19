/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { ReactNode } from "react";
import type { BusinessRecord } from "@/lib/business";
import { MEDIA_PLACEHOLDER_SRC } from "@/lib/media";
import { joinPublicPath } from "@/lib/public-path";
import { PublicAnalyticsTracker } from "@/components/public-analytics-tracker";

const navItems = [
  { href: "/", label: "Ana sayfa" },
  { href: "/services", label: "Hizmetler" },
  { href: "/vehicles", label: "Araçlar" },
  { href: "/routes", label: "Rotalar" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "İletişim" },
  { href: "/quote", label: "Teklif al" },
];

export function PublicSiteShell({
  business,
  children,
  basePath = "",
  trackAnalytics = true,
}: {
  business: BusinessRecord;
  children: ReactNode;
  basePath?: string;
  trackAnalytics?: boolean;
}) {
  const buildHref = (href: string) => joinPublicPath(basePath, href);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f1f5f9_100%)] text-slate-950">
      {trackAnalytics ? (
        <PublicAnalyticsTracker businessId={business.id} enabled />
      ) : null}
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href={buildHref("/")} className="text-lg font-semibold tracking-tight">
            {business.name}
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={buildHref(item.href)}
                className="rounded-full border border-slate-200 bg-white px-3 py-2 transition hover:border-slate-300 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            {description}
          </p>
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
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
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
