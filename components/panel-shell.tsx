"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { PanelNavItem } from "@/lib/navigation";

type PanelShellProps = {
  brand: string;
  title: string;
  summary: string;
  accentLabel: string;
  nav: PanelNavItem[];
  children: ReactNode;
};

export function PanelShell({
  brand,
  title,
  summary,
  accentLabel,
  nav,
  children,
}: PanelShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = search.trim();

    if (!query) {
      router.push("/app/search");
      return;
    }

    router.push(`/app/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="min-h-screen px-4 py-4 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1520px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="surface-strong flex flex-col rounded-[28px] p-5 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="rounded-[24px] bg-slate-950 px-5 py-6 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-orange-300">
              {accentLabel}
            </p>
            <h1 className="mt-3 text-2xl font-semibold">{brand}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-300">{title}</p>
          </div>

          <nav className="mt-6 grid gap-2">
            {nav.map((item) => {
              const isActive = pathname === item.href.split("#")[0];

              return (
                <Link
                  key={item.href}
                  className={[
                    "rounded-2xl border px-4 py-3 transition",
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10"
                      : "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300 hover:bg-white",
                  ].join(" ")}
                  href={item.href}
                >
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span
                    className={[
                      "mt-1 block text-xs",
                      isActive ? "text-slate-300" : "text-slate-500",
                    ].join(" ")}
                  >
                    {item.description}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-slate-200 pt-5">
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={handleLogout}
              type="button"
            >
              Çıkış yap
            </button>
          </div>
        </aside>

        <div className="grid min-w-0 gap-4">
          <header className="surface-strong rounded-[28px] px-6 py-5 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-500">
                  {accentLabel}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                  {summary}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
                  Host safe routing
                </span>
                <span className="rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-700">
                  Supabase ready
                </span>
              </div>
            </div>

            <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleSearch}>
              <input
                className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Global arama: rezervasyon, müşteri, görev..."
                value={search}
              />
              <button
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="submit"
              >
                Ara
              </button>
            </form>
          </header>

          <main className="surface-strong rounded-[28px] p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
