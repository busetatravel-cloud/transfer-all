import Link from "next/link";
import type { ReactNode } from "react";
import type { BusinessRecord } from "@/lib/business";

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
}: {
  business: BusinessRecord;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_40%,#f1f5f9_100%)] text-slate-950">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {business.name}
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
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
}: {
  title: string;
  description: string;
  href?: string;
}) {
  const card = (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </article>
  );

  if (!href) {
    return card;
  }

  return <Link href={href}>{card}</Link>;
}
