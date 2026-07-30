"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ThemeRegistryEntry } from "@/lib/theme-registry";
import type { ThemeTemplateKey } from "@/lib/theme-types";

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type Props = {
  entries: ThemeRegistryEntry[];
  selectedTemplateKey: ThemeTemplateKey;
};

export function ThemeSettingsModule({ entries, selectedTemplateKey }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<ThemeTemplateKey>(selectedTemplateKey);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "" });

  const hasChanges = selected !== selectedTemplateKey;

  async function handleSave() {
    if (saveState.status === "saving") {
      return;
    }

    setSaveState({ status: "saving", message: "" });

    try {
      const response = await fetch("/api/business/theme", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ templateKey: selected }),
      });

      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !body?.ok) {
        setSaveState({
          status: "error",
          message: body?.message || "Tema kaydedilemedi. Lütfen tekrar deneyin.",
        });
        return;
      }

      setSaveState({ status: "success", message: "Tema kaydedildi." });
      router.refresh();
    } catch {
      setSaveState({
        status: "error",
        message: "Tema kaydedilemedi. Lütfen tekrar deneyin.",
      });
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_60%,#eff6ff_100%)] p-6 shadow-sm lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Tema Ayarları
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 lg:text-4xl">
          Public sitenizin görünümünü seçin
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
          Tema yalnızca görünümü değiştirir; hizmetleriniz, araçlarınız, rotalarınız, blog
          yazılarınız ve iletişim bilgileriniz aynen korunur.
        </p>
      </article>

      {saveState.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            saveState.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {saveState.message}
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        {entries.map((entry) => {
          const isActive = entry.key === selected;
          const isCurrent = entry.key === selectedTemplateKey;

          return (
            <button
              key={entry.key}
              type="button"
              onClick={() => setSelected(entry.key)}
              className={`grid gap-4 rounded-[28px] border-2 p-5 text-left transition ${
                isActive
                  ? "border-slate-950 shadow-lg shadow-slate-900/10"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div
                className="grid gap-3 overflow-hidden rounded-[20px] p-4"
                style={{
                  background: entry.settings.backgroundColor,
                  color: entry.settings.textColor,
                  fontFamily: entry.settings.fontFamily,
                }}
              >
                <div
                  className="flex items-center justify-between rounded-full px-3 py-1.5 text-xs font-semibold"
                  style={{ background: entry.settings.surfaceColor }}
                >
                  <span>İşletme Adı</span>
                  <span style={{ color: entry.settings.secondaryColor }}>Teklif al</span>
                </div>
                <div className="grid gap-1.5">
                  <div className="text-lg font-semibold" style={{ fontFamily: entry.settings.fontFamily }}>
                    Konforlu ve güvenli transfer
                  </div>
                  <div
                    className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: entry.settings.secondaryColor,
                      color: entry.settings.backgroundColor,
                    }}
                  >
                    Rezervasyon yap
                  </div>
                </div>
                <div className="flex gap-2">
                  <div
                    className="h-10 flex-1 rounded-lg"
                    style={{ background: entry.settings.surfaceColor }}
                  />
                  <div
                    className="h-10 flex-1 rounded-lg"
                    style={{ background: entry.settings.surfaceColor }}
                  />
                  <div
                    className="h-10 flex-1 rounded-lg"
                    style={{ background: entry.settings.surfaceColor }}
                  />
                </div>
              </div>

              <div className="grid gap-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950">
                    {entry.label}
                  </h2>
                  {isCurrent ? (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Aktif
                    </span>
                  ) : null}
                </div>
                <p className="text-sm leading-6 text-slate-600">{entry.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          disabled={!hasChanges || saveState.status === "saving"}
          onClick={() => void handleSave()}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saveState.status === "saving" ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>
    </section>
  );
}
