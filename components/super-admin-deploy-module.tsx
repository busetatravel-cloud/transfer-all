"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type {
  DeployHealthCard,
  DeployReleaseRecord,
  DeployReleaseStatus,
  DeployChecklistItem,
} from "@/lib/deploy";

type Props = {
  healthCards: DeployHealthCard[];
  releases: DeployReleaseRecord[];
  checklistItems: DeployChecklistItem[];
  productionTarget: string | null;
};

type State = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatReleaseStatus(status: DeployReleaseStatus) {
  return (
    {
      draft: "Draft",
      ready: "Ready",
      deployed: "Deployed",
      rollback: "Rollback",
    }[status] ?? status
  );
}

async function readErrorBody(response: Response) {
  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as { message?: string; error?: string; code?: string } | string;
  } catch {
    return text;
  }
}

export function SuperAdminDeployModule({
  healthCards,
  releases,
  checklistItems,
  productionTarget,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "idle", message: "" });
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [releaseStatus, setReleaseStatus] = useState<DeployReleaseStatus>("draft");
  const [isPending, startTransition] = useTransition();

  const summary = useMemo(() => {
    const deployed = releases.filter((release) => release.status === "deployed").length;
    const draft = releases.filter((release) => release.status === "draft").length;
    const ready = releases.filter((release) => release.status === "ready").length;
    const rollback = releases.filter((release) => release.status === "rollback").length;

    return { deployed, draft, ready, rollback, total: releases.length };
  }, [releases]);

  async function refresh(message: string) {
    setState({ status: "success", message });
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "saving", message: "Release oluşturuluyor..." });

    try {
      const response = await fetch("/api/super-admin/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version,
          notes,
          status: releaseStatus,
        }),
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(
          typeof body === "string"
            ? body
            : body?.message ?? body?.error ?? "Release oluşturulamadı.",
        );
      }

      setVersion("");
      setNotes("");
      setReleaseStatus("draft");
      await refresh("Release kaydedildi.");
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Release oluşturulamadı.",
      });
    }
  }

  async function updateRelease(id: string, nextStatus: DeployReleaseStatus) {
    setState({ status: "saving", message: "Release güncelleniyor..." });

    try {
      const response = await fetch(`/api/super-admin/deploy/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(
          typeof body === "string"
            ? body
            : body?.message ?? body?.error ?? "Release güncellenemedi.",
        );
      }

      await refresh("Release güncellendi.");
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Release güncellenemedi.",
      });
    }
  }

  async function rollbackRelease(id: string) {
    const confirmed = window.confirm("Bu release rollback durumuna alınacak. Devam edilsin mi?");

    if (!confirmed) {
      return;
    }

    setState({ status: "saving", message: "Rollback hazırlanıyor..." });

    try {
      const response = await fetch(`/api/super-admin/deploy/${id}/rollback`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        throw new Error(
          typeof body === "string"
            ? body
            : body?.message ?? body?.error ?? "Rollback başarısız.",
        );
      }

      await refresh("Rollback kaydedildi.");
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Rollback başarısız.",
      });
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Deployment Merkezi
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Release, env ve rollback kontrolü
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Bu ekran yalnızca super admin içindir. Release notları, deploy geçmişi ve
          production checklist birlikte yönetilir.
        </p>
        <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
          <div className="font-semibold">Production target</div>
          <div className="mt-1 break-words">
            {productionTarget ?? "PUBLIC_DOMAIN_TARGET ayarlanmadı."}
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {healthCards.map((card) => (
          <article key={card.key} className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {card.label}
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  {card.status === "healthy"
                    ? "Healthy"
                    : card.status === "warning"
                      ? "Warning"
                      : "Down"}
                </h3>
              </div>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                  card.status === "healthy"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : card.status === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-rose-200 bg-rose-50 text-rose-700",
                ].join(" ")}
              >
                {card.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{card.description}</p>
            <p className="mt-4 text-xs text-slate-500">
              Son kontrol: {formatDateTime(card.lastCheckedAt)}
            </p>
          </article>
        ))}
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

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Release formu
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Yeni release oluştur
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 sm:grid-cols-4">
              <Stat label="Toplam" value={summary.total} />
              <Stat label="Draft" value={summary.draft} />
              <Stat label="Ready" value={summary.ready} />
              <Stat label="Deployed" value={summary.deployed} />
            </div>
          </div>

          <form className="mt-6 grid gap-4" onSubmit={handleCreate}>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Version</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                placeholder="v1.0.0"
                required
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Release notes</span>
              <textarea
                className="min-h-28 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Bu release'te ne değişti?"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                value={releaseStatus}
                onChange={(event) => setReleaseStatus(event.target.value as DeployReleaseStatus)}
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="deployed">Deployed</option>
                <option value="rollback">Rollback</option>
              </select>
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isPending}
              >
                Release kaydet
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => {
                  setVersion("");
                  setNotes("");
                  setReleaseStatus("draft");
                }}
              >
                Temizle
              </button>
            </div>
          </form>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Production checklist
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Canlıya hazır mı?
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Checklist, deploy merkezi ile aynı ekranda takip edilir.
          </p>

          <div className="mt-5 grid gap-3">
            {checklistItems.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs leading-6 text-slate-500">{item.detail}</p>
                </div>
                <span
                  className={[
                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
                    item.done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  ].join(" ")}
                >
                  {item.done ? "OK" : "Bekliyor"}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Deploy geçmişi
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Kayıtlar
            </h2>
          </div>
          <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Ready" value={summary.ready} />
            <Stat label="Rollback" value={summary.rollback} />
            <Stat label="Deployed" value={summary.deployed} />
            <Stat label="Draft" value={summary.draft} />
          </div>
        </div>

        <div className="mt-6 grid gap-4">
          {releases.length ? (
            releases.map((release) => (
              <article
                key={release.id}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {release.version}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                      {formatReleaseStatus(release.status)}
                    </h3>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                    {release.status}
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Meta label="Released at" value={formatDateTime(release.releasedAt)} />
                  <Meta label="Released by" value={release.releasedBy ?? "-"} />
                  <Meta label="Created at" value={formatDateTime(release.createdAt)} />
                  <Meta label="Updated at" value={formatDateTime(release.updatedAt)} />
                </dl>

                {release.notes ? (
                  <p className="mt-4 text-sm leading-7 text-slate-600">{release.notes}</p>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-slate-500">Release notu yok.</p>
                )}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    type="button"
                    disabled={isPending}
                    onClick={() => void updateRelease(release.id, "ready")}
                  >
                    Ready
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={isPending}
                    onClick={() => void updateRelease(release.id, "deployed")}
                  >
                    Deployed
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={isPending}
                    onClick={() => void rollbackRelease(release.id)}
                  >
                    Rollback
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Henüz release kaydı yok.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
