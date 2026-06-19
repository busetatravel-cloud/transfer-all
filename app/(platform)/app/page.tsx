import Link from "next/link";
import { requireBusinessSession } from "@/lib/auth";
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
  { href: "/app/publishing", title: "Yayın Merkezi", description: "Taslak ve yayın geçmişi." },
  { href: "/app/operation", title: "Operation", description: "Günlük operasyon." },
  { href: "/app/finance", title: "Finance", description: "Tahsilat ve ciro." },
  { href: "/app/customers", title: "Customers", description: "CRM ve müşteri kartları." },
  { href: "/app/password", title: "Password", description: "Admin şifresi." },
];

export default async function BusinessDashboardPage() {
  const session = await requireBusinessSession();
  const panel = await getBusinessPanelData(session.businessId);
  const tasks = await listTasks(session.businessId);
  const unreadNotifications = await getUnreadNotificationCount(session.businessId);

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
  const tomorrowKey = toDateKey(addDays(today, 1));
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
    tomorrow: reservations.filter((reservation) => reservation.travelDate === tomorrowKey).length,
  };

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
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            Paket bilgisi
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Bu alan yalnızca görüntüleme amaçlıdır.
          </p>
          <div className="mt-4 grid gap-3">
            <Metric label="Mevcut paket" value={panel.business.packageName ?? "Plan yok"} />
            <Metric label="Başlangıç" value={formatDate(panel.business.packageStart)} />
            <Metric label="Bitiş" value={formatDate(panel.business.packageEnd)} />
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
          <div className="mt-4 max-w-sm">
            <Metric label="Okunmamış bildirim" value={String(unreadNotifications)} />
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

function formatDate(value: string | null) {
  if (!value) {
    return "Yok";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(date);
}
