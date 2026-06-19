"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditLogRecord } from "@/lib/audit";

type Scope = "business" | "super-admin";

type Props = {
  scope: Scope;
  logs: AuditLogRecord[];
};

const ENTITY_LABELS: Record<string, string> = {
  reservation: "Rezervasyon",
  voucher: "Voucher",
  publication: "Yayın",
  deploy: "Deploy",
  domain: "Domain",
  media: "Medya",
  task: "Görev",
  finance: "Finans",
  business: "Business",
  plan: "Plan",
};

function safeText(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value.trim() || "-";
  }

  return JSON.stringify(value, null, 2);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function canRollback(log: AuditLogRecord) {
  if (log.entityType === "publication") {
    return true;
  }

  if (log.entityType === "reservation") {
    return log.action === "create" || log.action === "update";
  }

  if (log.entityType === "task") {
    return log.action === "create" || log.action === "update";
  }

  if (log.entityType === "domain") {
    return true;
  }

  return false;
}

export function AuditModule({ scope, logs }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [module, setModule] = useState("all");
  const [date, setDate] = useState("");
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const filteredLogs = useMemo(() => {
    const safeQuery = query.trim().toLowerCase();

    return logs.filter((log) => {
      const matchesActor =
        actor === "all" ||
        String(log.actorUserId ?? "").includes(actor) ||
        String(log.actorRole ?? "").toLowerCase().includes(actor.toLowerCase());
      const matchesAction = action === "all" || log.action === action;
      const matchesModule = module === "all" || log.entityType === module;
      const matchesDate = !date || log.createdAt.slice(0, 10) === date;
      const matchesQuery =
        !safeQuery ||
        [log.entityId, log.entityType, log.action, log.actorRole, log.actorUserId]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(safeQuery));

      return matchesActor && matchesAction && matchesModule && matchesDate && matchesQuery;
    });
  }, [logs, query, actor, action, module, date]);

  async function rollback(log: AuditLogRecord) {
    const confirmed = window.confirm("Bu kayıt geri alınacak. Devam edilsin mi?");

    if (!confirmed) {
      return;
    }

    setRollingBack(log.id);

    try {
      const response = await fetch(
        scope === "business"
          ? `/api/business/audit/${log.id}/rollback`
          : `/api/super-admin/audit/${log.id}/rollback`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          (body as { message?: string; error?: string } | null)?.message ??
            (body as { message?: string; error?: string } | null)?.error ??
            "Geri alma başarısız.",
        );
      }

      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Geri alma başarısız.");
    } finally {
      setRollingBack(null);
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Audit log
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            {scope === "super-admin" ? "Sistem genel kayıtlar" : "Business kayıtları"}
          </h1>
          <p className="text-sm leading-7 text-slate-600">
            Kim, ne zaman, hangi kaydı değiştirdi. Detayda önce ve sonra hali görünür.
          </p>
        </div>
      </article>

      <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Kullanıcı</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            placeholder="user id veya rol"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">İşlem tipi</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="create / update / delete"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Modül</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            value={module}
            onChange={(event) => setModule(event.target.value)}
            placeholder="reservation / task / ..."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Tarih</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Arama</span>
          <input
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="entity id / kullanıcı / işlem"
          />
        </label>
      </div>

      <div className="grid gap-4">
        {filteredLogs.length ? (
          filteredLogs.map((log) => (
            <article key={log.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="grid gap-1">
                  <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                    <span>{ENTITY_LABELS[log.entityType] ?? log.entityType}</span>
                    <span>{log.action}</span>
                  </div>
                  <h2 className="text-lg font-semibold text-slate-950">
                    {log.entityId}
                  </h2>
                  <p className="text-sm text-slate-600">
                    Kullanıcı: {log.actorUserId ?? "-"} • Rol: {log.actorRole}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                </div>
                {canRollback(log) ? (
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={rollingBack === log.id}
                    type="button"
                    onClick={() => void rollback(log)}
                  >
                    Geri al
                  </button>
                ) : null}
              </div>

              <details className="mt-4 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                  Önce → Sonra
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <pre className="overflow-auto rounded-[16px] bg-white p-4 text-xs leading-6 text-slate-700">
                    {safeText(log.before)}
                  </pre>
                  <pre className="overflow-auto rounded-[16px] bg-white p-4 text-xs leading-6 text-slate-700">
                    {safeText(log.after)}
                  </pre>
                </div>
              </details>
            </article>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Audit kaydı yok.
          </div>
        )}
      </div>
    </section>
  );
}
