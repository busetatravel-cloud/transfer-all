"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessPublicationRevisionRecord,
  BusinessPublishingCenterData,
} from "@/lib/publishing";

type PublishingCenterProps = {
  businessId: string;
  data: BusinessPublishingCenterData;
};

type SubmitState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type ErrorPayload = {
  message?: string;
  code?: string;
  stack?: string | null;
};

export function PublishingCenter({ businessId, data }: PublishingCenterProps) {
  const router = useRouter();
  const [state, setState] = useState<SubmitState>({ status: "idle", message: "" });

  const archivedCount = useMemo(
    () => data.history.filter((item) => item.status === "archived").length,
    [data.history],
  );

  async function runAction(action: "publish" | "rollback") {
    setState({ status: "saving", message: "İşlem hazırlanıyor..." });

    const response = await fetch("/api/business/publishing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      let json: ErrorPayload | null = null;

      if (raw) {
        try {
          json = JSON.parse(raw) as ErrorPayload;
        } catch {
          json = null;
        }
      }

      setState({
        status: "error",
        message:
          json?.message || json?.code || raw || "Yayın işlemi tamamlanamadı.",
      });
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | { revision?: BusinessPublicationRevisionRecord }
      | null;

    setState({
      status: "success",
      message:
        action === "publish"
          ? `Yayınlandı. Sürüm ${payload?.revision?.version ?? "-"}.`
          : `Geri alındı. Sürüm ${payload?.revision?.version ?? "-"} yayınlandı.`,
    });
    router.refresh();
  }

  const currentRevision = data.currentRevision;
  const publishedRevision = data.publishedRevision;

  return (
    <section className="grid gap-6">
      <header className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div className="grid gap-3">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
            Yayın Merkezi
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Taslak, önizleme, yayın ve geri alma akışı
          </h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-600">
            Business admin içerik düzenlemeleri burada doğrudan public siteye
            düşmez. Önce önizle, sonra yayınla. İstersen son yayınlanmış sürüme geri dön.
          </p>
          {state.message ? (
            <div
              className={[
                "rounded-2xl border px-4 py-3 text-sm",
                state.status === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : state.status === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-700",
              ].join(" ")}
            >
              {state.message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Taslak" value={data.draftPanel ? "Hazır" : "Boş"} />
            <Metric
              label="Önizleme"
              value="Live draft"
            />
            <Metric
              label="Yayın"
              value={publishedRevision ? `v${publishedRevision.version}` : "Yok"}
            />
            <Metric label="Arşiv" value={`${archivedCount}`} />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <a
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              href={`/preview/${businessId}`}
              target="_blank"
              rel="noreferrer"
            >
              Önizle
            </a>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={state.status === "saving"}
              onClick={() => {
                void runAction("publish");
              }}
              type="button"
            >
              Yayınla
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={state.status === "saving" || !currentRevision}
              onClick={() => {
                void runAction("rollback");
              }}
              type="button"
            >
              Geri al
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Yayımlanan içerik özeti
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <SummaryRow label="Firma" value={data.draftPanel?.business?.name ?? data.business?.name ?? "-"} />
            <SummaryRow label="Hero" value={data.draftPanel?.profile.heroTitle || "Boş"} />
            <SummaryRow label="Hizmetler" value={`${data.draftPanel?.services.length ?? 0}`} />
            <SummaryRow label="Araçlar" value={`${data.draftPanel?.vehicles.length ?? 0}`} />
            <SummaryRow label="Rotalar" value={`${data.draftPanel?.routes.length ?? 0}`} />
            <SummaryRow label="Blog" value={`${data.draftPanel?.blogs.length ?? 0}`} />
            <SummaryRow label="Dil" value={`${data.draftPanel?.locales.length ?? 0}`} />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Yayın geçmişi
          </h2>
          <div className="mt-4 grid gap-3">
            {data.history.length ? (
              data.history.map((item) => <HistoryCard key={item.id} item={item} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Henüz yayın geçmişi yok.
              </div>
            )}
          </div>
        </article>
      </section>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-950">{value}</span>
    </div>
  );
}

function HistoryCard({ item }: { item: BusinessPublicationRevisionRecord }) {
  const tone =
    item.status === "published"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : item.status === "archived"
        ? "border-slate-200 bg-slate-50 text-slate-600"
        : item.status === "preview"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">Sürüm {item.version}</div>
          <div className="mt-1 text-xs text-slate-500">{item.note || "Not yok"}</div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
          {statusLabel(item.status)}
        </span>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-500">
        <div>Oluşturulma: {formatDate(item.createdAt)}</div>
        <div>Yayın: {item.publishedAt ? formatDate(item.publishedAt) : "-"}</div>
        <div>Arşiv: {item.archivedAt ? formatDate(item.archivedAt) : "-"}</div>
      </div>
    </div>
  );
}

function statusLabel(status: BusinessPublicationRevisionRecord["status"]) {
  switch (status) {
    case "draft":
      return "Taslak";
    case "preview":
      return "Önizleme";
    case "published":
      return "Yayınlandı";
    case "archived":
      return "Arşiv";
  }
}

function formatDate(value: string) {
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
