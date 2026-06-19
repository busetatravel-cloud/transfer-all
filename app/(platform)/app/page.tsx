import Link from "next/link";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessAnalyticsSummary } from "@/lib/analytics";
import { getBusinessPanelData } from "@/lib/business-panel";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { listTasks } from "@/lib/tasks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = [
  { href: "/app/dashboard", title: "Dashboard", description: "Panel özeti ve modüller." },
  { href: "/app/company", title: "Company", description: "Firma bilgileri, hero ve logo." },
  { href: "/app/domain", title: "Domain", description: "Domain bağlama ve durum." },
  { href: "/app/media", title: "Media", description: "Görsel ve medya yönetimi." },
  { href: "/app/services", title: "Services", description: "Hizmet CRUD." },
  { href: "/app/vehicles", title: "Vehicles", description: "Araç CRUD." },
  { href: "/app/routes", title: "Routes", description: "Rota CRUD." },
  { href: "/app/blog", title: "Blog", description: "Blog CRUD." },
  { href: "/app/seo", title: "SEO", description: "Meta alanları." },
  { href: "/app/languages", title: "Languages", description: "Dil içerikleri." },
  { href: "/app/reservations", title: "Reservations", description: "Rezervasyonlar." },
  { href: "/app/tasks", title: "Görevler", description: "Hatırlatmalar ve iş akışları." },
  { href: "/app/search", title: "Arama", description: "Global business araması." },
  { href: "/app/analytics", title: "Analytics", description: "Ziyaret ve dönüşüm." },
  { href: "/app/publishing", title: "Yayın Merkezi", description: "Taslak ve yayın geçmişi." },
  { href: "/app/operation", title: "Operation", description: "Günlük operasyon." },
  { href: "/app/finance", title: "Finance", description: "Tahsilat ve ciro." },
  { href: "/app/customers", title: "Customers", description: "CRM ve müşteri kartları." },
  { href: "/app/password", title: "Password", description: "Admin şifresi." },
];

export default async function BusinessDashboardPage() {
  const session = await requireBusinessSession();
  const [panel, tasks, unreadNotifications, analytics] = await Promise.all([
    getBusinessPanelData(session.businessId),
    listTasks(session.businessId),
    getUnreadNotificationCount(session.businessId),
    getBusinessAnalyticsSummary(session.businessId),
  ]);

  if (!panel.business) {
    return (
      <section className="grid min-h-[60vh] place-items-center">
        <article className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Empty state
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Business kaydı bulunamadı
          </h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Bu oturum için eşleşen business verisi yok. Panel, yalnızca kendi businessId kaydını gösterir.
          </p>
        </article>
      </section>
    );
  }

  const reservations = panel.requests;
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekEndKey = toDateKey(addDays(today, 7));

  const taskStats = {
    today: tasks.filter((task) => task.dueDate === todayKey && task.status !== "Tamamlandı").length,
    overdue: tasks.filter((task) => task.dueDate && task.dueDate < todayKey && task.status !== "Tamamlandı").length,
    upcoming: tasks.filter(
      (task) =>
        task.dueDate &&
        task.dueDate >= todayKey &&
        task.dueDate <= weekEndKey &&
        task.status !== "Tamamlandı",
    ).length,
    completed: tasks.filter((task) => task.status === "Tamamlandı").length,
  };

  const reservationStats = {
    today: reservations.filter((reservation) => reservation.travelDate === todayKey).length,
    pending: reservations.filter((reservation) => reservation.bookingStatus === "Bekliyor").length,
    confirmed: reservations.filter((reservation) =>
      ["Onaylandı", "Şoför Atandı"].includes(reservation.bookingStatus),
    ).length,
    paymentDue: reservations.filter((reservation) =>
      ["Ödenmedi", "Kapora Alındı"].includes(reservation.paymentStatus),
    ).length,
  };

  const financeStats = buildFinanceStats(reservations, todayKey);
  const financeCurrency = buildFinanceCurrency(reservations);

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Business panel
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              {panel.business.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Modül kartından ilgili sayfaya geç. Her bölüm kendi route sayfasında açılır.
            </p>
          </div>
          <dl className="grid gap-3 text-sm text-slate-600">
            <Detail label="Business email" value={panel.business.email} />
            <Detail label="Domain" value={panel.business.domain ?? "Not set"} />
            <Detail label="Session" value={session.email} />
          </dl>
        </div>
      </article>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Görev özeti</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Bugün" value={String(taskStats.today)} />
            <Metric label="Geciken" value={String(taskStats.overdue)} />
            <Metric label="Yaklaşan" value={String(taskStats.upcoming)} />
            <Metric label="Tamamlanan" value={String(taskStats.completed)} />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Rezervasyon özeti</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Bugün rezervasyon" value={String(reservationStats.today)} />
            <Metric label="Bekleyen rezervasyon" value={String(reservationStats.pending)} />
            <Metric label="Onaylanan rezervasyon" value={String(reservationStats.confirmed)} />
            <Metric label="Ödeme bekleyen" value={String(reservationStats.paymentDue)} />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Finans özeti</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Bugünkü kâr" value={formatMoneyValue(financeStats.todayProfit, financeCurrency)} />
            <Metric label="Toplam kâr" value={formatMoneyValue(financeStats.totalProfit, financeCurrency)} />
            <Metric
              label="Tedarikçiye ödenecek"
              value={formatMoneyValue(financeStats.supplierPayable, financeCurrency)}
            />
            <Metric
              label="Acenteden alınacak"
              value={formatMoneyValue(financeStats.agencyReceivable, financeCurrency)}
            />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Analytics özeti</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Metric label="Bugün ziyaret" value={String(analytics.todayVisits)} />
            <Metric label="Toplam ziyaret" value={String(analytics.totalVisits)} />
            <Metric label="Dönüşüm" value={String(analytics.conversions)} />
            <Metric label="Oran" value={`${analytics.conversionRate}%`} />
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Bildirim özeti
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Okunmamış bildirimler için hızlı durum görünümü.
              </p>
            </div>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
              href="/app/notifications"
            >
              Bildirimlere git
            </Link>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Metric label="Okunmamış bildirim" value={String(unreadNotifications)} />
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                En çok ziyaret edilen sayfalar
              </div>
              <div className="mt-3 grid gap-2">
                {analytics.popularPages.slice(0, 3).length ? (
                  analytics.popularPages.slice(0, 3).map((item) => (
                    <div
                      key={`${item.pagePath}-${item.pageType}`}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <div>
                        <div className="font-medium text-slate-900">{item.pageType}</div>
                        <div className="text-slate-500">{item.pagePath}</div>
                      </div>
                      <div className="font-semibold text-slate-900">{item.visits}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Henüz yeterli veri yok.</p>
                )}
              </div>
            </div>
          </div>
        </article>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Module
            </div>
            <div className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
              {item.title}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toMoney(value: number | string | null | undefined) {
  return Number.isFinite(Number(value ?? 0)) ? Number(value ?? 0) : 0;
}

function buildFinanceCurrency(
  reservations: Array<{
    currency?: string | null;
  }>,
) {
  const currencies = Array.from(
    new Set(
      reservations
        .map((reservation) => String(reservation.currency ?? "").trim())
        .filter(Boolean),
    ),
  );

  return currencies.length === 1 ? currencies[0] : null;
}

function formatMoneyValue(value: number, currency?: string | null) {
  const amount = Number.isFinite(value) ? value : 0;
  const formatted = new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

  const safeCurrency = String(currency ?? "").trim();
  return safeCurrency ? `${formatted} ${safeCurrency}` : formatted;
}

function buildFinanceStats(
  reservations: Array<{
    travelDate?: string | null;
    totalAmount?: number | string | null;
    collectedAmount?: number | string | null;
    supplierPass?: number | string | null;
    agencyPass?: number | string | null;
    supplierCollection?: number | string | null;
    profit?: number | string | null;
  }>,
  todayKey: string,
) {
  return reservations.reduce(
    (summary, reservation) => {
      const totalProfit = toMoney(reservation.profit);
      const supplierPass = toMoney(reservation.supplierPass);
      const agencyPass = toMoney(reservation.agencyPass);
      const profit =
        totalProfit || toMoney(reservation.collectedAmount) + agencyPass - supplierPass;

      summary.totalProfit += profit;
      summary.supplierPayable += supplierPass;
      summary.agencyReceivable += agencyPass;

      if (reservation.travelDate === todayKey) {
        summary.todayProfit += profit;
      }

      return summary;
    },
    {
      todayProfit: 0,
      totalProfit: 0,
      supplierPayable: 0,
      agencyReceivable: 0,
    },
  );
}
