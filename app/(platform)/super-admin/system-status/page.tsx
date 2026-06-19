import { requireRole } from "@/lib/auth";
import { getSystemStatusCards, type SystemStatusState } from "@/lib/system-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATUS_LABELS: Record<SystemStatusState, string> = {
  healthy: "Healthy",
  warning: "Warning",
  down: "Down",
};

const STATUS_CLASSES: Record<SystemStatusState, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  down: "border-rose-200 bg-rose-50 text-rose-700",
};

export default async function SystemStatusPage() {
  await requireRole("SUPER_ADMIN");
  const cards = await getSystemStatusCards();

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Sistem Durumu
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Sağlık ve kontrol paneli
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
          Bu ekran yalnızca super admin için görünür. Kontroller dış servis çağrısı yapmadan, mevcut internal
          yapı ve konfigürasyondan okunur.
        </p>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.key}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {card.label}
                </div>
                <div className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  {STATUS_LABELS[card.status]}
                </div>
              </div>
              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                  STATUS_CLASSES[card.status],
                ].join(" ")}
              >
                {card.status}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{card.description}</p>
            <p className="mt-4 text-xs text-slate-500">
              Son kontrol: {formatDate(card.lastCheckedAt)}
            </p>
          </article>
        ))}
      </div>
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
    timeStyle: "medium",
  }).format(date);
}
