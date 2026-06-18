import Link from "next/link";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessPanelData } from "@/lib/business-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modules = [
  { href: "/app/dashboard", title: "Dashboard", description: "Panel ozeti ve moduller." },
  { href: "/app/company", title: "Company", description: "Firma bilgileri, hero ve logo." },
  { href: "/app/domain", title: "Domain", description: "Domain baglama ve durum." },
  { href: "/app/media", title: "Media", description: "Gorsel ve medya yonetimi." },
  { href: "/app/services", title: "Services", description: "Hizmet CRUD." },
  { href: "/app/vehicles", title: "Vehicles", description: "Araç CRUD." },
  { href: "/app/routes", title: "Routes", description: "Rota CRUD." },
  { href: "/app/blog", title: "Blog", description: "Blog CRUD." },
  { href: "/app/seo", title: "SEO", description: "Meta alanlari." },
  { href: "/app/languages", title: "Languages", description: "Dil içerikleri." },
  { href: "/app/reservations", title: "Reservations", description: "Rezervasyonlar." },
  { href: "/app/operation", title: "Operation", description: "Gunluk operasyon." },
  { href: "/app/finance", title: "Finance", description: "Tahsilat ve ciro." },
  { href: "/app/customers", title: "Customers", description: "CRM ve musteri kartlari." },
  { href: "/app/password", title: "Password", description: "Admin sifresi." },
];

export default async function BusinessDashboardPage() {
  const session = await requireBusinessSession();
  const panel = await getBusinessPanelData(session.businessId);

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
