"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { BusinessListRecord } from "@/lib/business";
import { formatDomainStatusLabel, formatSslStatusLabel } from "@/lib/domain-utils";

type Props = {
  businesses: BusinessListRecord[];
};

type State = {
  status: "idle" | "saving" | "error" | "success";
  message: string;
};

async function readErrorBody(response: Response) {
  const rawText = await response.text().catch(() => "");

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as
      | {
          error?: string;
          message?: string;
          code?: string;
        }
      | string;
  } catch {
    return rawText;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function SuperAdminDomainsModule({ businesses }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "idle", message: "" });
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const domains = businesses.filter((business) => business.domain || business.hostname);
    const pendingOrDns = domains.filter(
      (business) => business.domainStatus === "pending" || business.domainStatus === "dns_detected",
    );

    return {
      total: domains.length,
      active: domains.filter((business) => business.domainStatus === "active").length,
      verified: domains.filter((business) => business.domainStatus === "verified").length,
      pending: pendingOrDns.length,
      failed: domains.filter((business) => business.domainStatus === "failed").length,
      providerAdded: domains.filter((business) => business.domainProviderStatus === "provider_added").length,
    };
  }, [businesses]);

  async function runAction(
    businessId: string,
    action: "force_active" | "passive" | "provider_add" | "provider_retry" | "provider_remove",
  ) {
    setState({ status: "saving", message: "İşlem hazırlanıyor..." });

    try {
      const response = await fetch("/api/super-admin/domains", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, action }),
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        setState({
          status: "error",
          message:
            typeof body === "string"
              ? body
              : body?.message ?? body?.error ?? "Domain işlemi başarısız.",
        });
        return;
      }

      setState({
        status: "success",
        message:
          action === "force_active"
            ? "Domain zorla aktif edildi."
            : action === "passive"
              ? "Domain pasif edildi."
              : action === "provider_remove"
                ? "Provider bağlantısı kaldırıldı."
                : "Provider işlemi tamamlandı.",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Domain işlemi başarısız.",
      });
    }
  }

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Toplam domain" value={summary.total} />
        <StatCard label="Aktif" value={summary.active} />
        <StatCard label="Doğrulandı" value={summary.verified} />
        <StatCard label="Bekliyor" value={summary.pending} />
        <StatCard label="Başarısız" value={summary.failed} />
        <StatCard label="Provider eklendi" value={summary.providerAdded} />
      </div>

      {state.status !== "idle" ? (
        <p
          className={[
            "rounded-2xl border px-4 py-3 text-sm",
            state.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {businesses.map((business) => {
          const hostname = business.hostname ?? business.domain ?? "";
          const hasDomain = Boolean(hostname);

          return (
            <article key={business.id} className="rounded-[28px] border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {business.name}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {hostname || "Domain bağlı değil"}
                  </h3>
                </div>
                <div className="grid gap-2 text-right">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Durum: {formatDomainStatusLabel(business.domainStatus)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    SSL: {formatSslStatusLabel(business.sslStatus)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Provider: {business.domainProviderStatus ?? "manual"}
                  </span>
                </div>
              </div>

              <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                <MetaItem label="Hostname" value={hostname || "-"} />
                <MetaItem label="Token" value={business.verificationToken ?? "-"} />
                <MetaItem label="Provider" value={business.domainProvider === "vercel" ? "Vercel" : "Manual"} />
                <MetaItem label="Provider status" value={business.domainProviderStatus ?? "-"} />
                <MetaItem label="Son kontrol" value={formatDateTime(business.lastCheckedAt)} />
                <MetaItem label="Verified at" value={formatDateTime(business.verifiedAt)} />
                <MetaItem label="Activated at" value={formatDateTime(business.activatedAt)} />
                <MetaItem label="Business ID" value={business.id} />
              </dl>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !hasDomain}
                  onClick={() => void runAction(business.id, "force_active")}
                  type="button"
                >
                  Zorla aktif et
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !hasDomain}
                  onClick={() => void runAction(business.id, "passive")}
                  type="button"
                >
                  Pasif et
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !hasDomain}
                  onClick={() => void runAction(business.id, "provider_add")}
                  type="button"
                >
                  Vercel&apos;e ekle
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !hasDomain}
                  onClick={() => void runAction(business.id, "provider_retry")}
                  type="button"
                >
                  Yeniden dene
                </button>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPending || !hasDomain}
                  onClick={() => void runAction(business.id, "provider_remove")}
                  type="button"
                >
                  Provider’dan kaldır
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
    </article>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
