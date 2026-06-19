import Link from "next/link";
import type { BusinessAnalyticsEventRecord, BusinessAnalyticsSummary } from "@/lib/analytics";

type Props = {
  summary: BusinessAnalyticsSummary;
  recentEvents: BusinessAnalyticsEventRecord[];
};

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function AnalyticsModule({ summary, recentEvents }: Props) {
  return (
    <section className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bugün ziyaret" value={summary.todayVisits} />
        <StatCard label="Toplam ziyaret" value={summary.totalVisits} />
        <StatCard label="Dönüşüm" value={summary.conversions} />
        <StatCard label="Dönüşüm oranı" value={`${summary.conversionRate}%`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Son ziyaretler
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Ziyaret akışı
              </h2>
            </div>
            <Link
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
              href="/app/dashboard"
            >
              Dashboard
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            {recentEvents.length ? (
              recentEvents.slice(0, 12).map((event) => (
                <div
                  key={event.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {event.pageType} · {event.eventName}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{event.pagePath}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Referrer: {event.referrer ?? "-"}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyText title="Ziyaret yok" description="Henüz analytics kaydı oluşmadı." />
            )}
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Popüler sayfalar
          </p>
          <div className="mt-5 grid gap-3">
            {summary.popularPages.length ? (
              summary.popularPages.map((item, index) => (
                <div
                  key={`${item.pagePath}-${index}`}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {item.pageType}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{item.pagePath}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                      {item.visits} ziyaret
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <EmptyText title="Popüler sayfa yok" description="Ziyaret birikince burada görünür." />
            )}
          </div>

          <div className="mt-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Dönüşüm özeti
            </p>
            <div className="mt-3 grid gap-2 text-sm text-emerald-900">
              <p>Toplam ziyaret: {summary.totalVisits}</p>
              <p>Dönüşüm sayısı: {summary.conversions}</p>
              <p>Oran: {summary.conversionRate}%</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
    </article>
  );
}

function EmptyText({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 bg-white px-4 py-5">
      <div className="font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
