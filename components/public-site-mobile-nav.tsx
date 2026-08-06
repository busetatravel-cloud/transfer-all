"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Faz 15 — Header'ın TEK client parçası. Masaüstü nav (PublicSiteShell'te,
// server tarafında) DEĞİŞMEDEN kalır; bu bileşen yalnızca mobilde (md
// altında) hamburger düğmesi + açılır panel state'ini yönetir. Nav
// linklerinin KENDİSİ (href/label/aktif durum) server'dan prop olarak gelir
// — bu bileşen yalnızca "açık mı kapalı mı" bilgisini taşır.
export function MobileNav({
  items,
  ctaHref,
  ctaLabel,
}: {
  items: Array<{ href: string; label: string; active: boolean }>;
  ctaHref: string;
  ctaLabel: string;
}) {
  const [open, setOpen] = useState(false);

  // Sayfa değişiminde (bir linke tıklandığında) menüyü otomatik kapat.
  useEffect(() => {
    setOpen(false);
  }, [items]);

  return (
    <div className="lg:hidden">
      <button
        aria-controls="ps-mobile-nav-panel"
        aria-expanded={open}
        aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
        className="ps-cta-outline flex h-11 w-11 items-center justify-center !px-0"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {open ? (
        <div
          className="ps-animate-in absolute inset-x-0 top-full z-30 border-b border-[color-mix(in_srgb,var(--ps-secondary)_25%,transparent)] bg-[var(--ps-surface)] px-4 py-4 shadow-lg"
          id="ps-mobile-nav-panel"
        >
          <nav className="flex flex-col gap-1">
            {items.map((item) => (
              <Link
                aria-current={item.active ? "page" : undefined}
                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                  item.active
                    ? "bg-[color-mix(in_srgb,var(--ps-secondary)_15%,transparent)] text-[var(--ps-primary)]"
                    : "text-[var(--ps-text)] hover:bg-[color-mix(in_srgb,var(--ps-secondary)_10%,transparent)]"
                }`}
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="ps-cta-primary ps-cta-mobile-block mt-4" href={ctaHref} onClick={() => setOpen(false)}>
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
