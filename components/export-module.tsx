"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExportLogRecord, ExportPreview, ExportType } from "@/lib/export";

type Props = {
  businessId: string;
  initialLogs: ExportLogRecord[];
  initialPreview: ExportPreview;
  initialType: ExportType;
};

type LoadState = {
  status: "idle" | "loading" | "success" | "error";
  message: string;
};

const EXPORT_LABELS: Record<ExportType, string> = {
  reservations: "Rezervasyonlar",
  customers: "Müşteriler",
  tasks: "Görevler",
  finance: "Finans özeti",
  operation: "Operasyon listesi",
};

export function ExportModule({
  businessId,
  initialLogs,
  initialPreview,
  initialType,
}: Props) {
  const router = useRouter();
  const [type, setType] = useState<ExportType>(initialType);
  const [preview, setPreview] = useState(initialPreview);
  const [logs, setLogs] = useState(initialLogs);
  const [state, setState] = useState<LoadState>({ status: "idle", message: "" });

  const previewText = useMemo(() => preview.csv, [preview]);

  async function loadPreview(nextType: ExportType) {
    setState({ status: "loading", message: "CSV hazırlanıyor..." });

    try {
      const response = await fetch(`/api/business/export?type=${encodeURIComponent(nextType)}`, {
        headers: { Accept: "application/json" },
      });

      const body = (await response.json().catch(() => null)) as
        | { csv?: string; rowCount?: number; log?: ExportLogRecord; preview?: ExportPreview; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.message || "Export hazırlanamadı.");
      }

      if (body?.preview) {
        setPreview(body.preview);
      } else if (body?.csv && typeof body.rowCount === "number") {
        setPreview({
          exportType: nextType,
          csv: body.csv,
          rowCount: body.rowCount,
          headers: preview.headers,
          rows: preview.rows,
        });
      }

      if (body?.log) {
        setLogs((current) => [body.log!, ...current]);
      }

      setType(nextType);
      setState({ status: "success", message: "CSV önizleme güncellendi." });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Export hazırlanamadı.",
      });
    }
  }

  async function copyCsv() {
    try {
      await navigator.clipboard.writeText(preview.csv);
      setState({ status: "success", message: "CSV panoya kopyalandı." });

      const currentLog = logs[0];

      if (currentLog) {
        await fetch(`/api/business/export/${currentLog.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ status: "copied" }),
        });

        setLogs((current) =>
          current.map((item) =>
            item.id === currentLog.id ? { ...item, status: "copied" } : item,
          ),
        );
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Kopyalama başarısız.",
      });
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Export / Yedek
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          CSV önizleme ve kopyalama
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Gerçek dosya indirme ve cloud backup yok. BusinessId izolasyonu korunur.
        </p>
        <p className="mt-2 text-xs text-slate-500">Business ID: {businessId}</p>

        {state.message ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              state.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : state.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Veri tipi</span>
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400"
              value={type}
              onChange={(event) => loadPreview(event.target.value as ExportType)}
            >
              {Object.entries(EXPORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="button"
              onClick={copyCsv}
            >
              Kopyala
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              type="button"
              onClick={() => loadPreview(type)}
            >
              Önizlemeyi yenile
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
            CSV Önizleme
          </div>
          <pre className="max-h-[560px] overflow-auto p-4 text-xs leading-6 text-slate-700">
            {previewText}
          </pre>
        </div>
      </article>

      <article className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Export geçmişi
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Kayıtlar
          </h2>
        </div>

        <div className="grid gap-3">
          {logs.length ? (
            logs.map((log) => (
              <article
                key={log.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {EXPORT_LABELS[log.exportType]}
                    </div>
                    <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                      {log.rowCount} satır
                    </div>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {log.status}
                  </span>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  {formatDate(log.createdAt)}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              Henüz export kaydı yok.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
