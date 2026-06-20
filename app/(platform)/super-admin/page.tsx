import { BusinessCreateForm } from "@/components/business-create-form";
import { SuperAdminBusinessCard } from "@/components/super-admin-business-card";
import { loadSuperAdminBusinesses } from "@/lib/business";
import { listPlans } from "@/lib/plans";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const metrics = [
  { label: "Businesses", value: "12", note: "Aktif hesap sayisi" },
  { label: "Active plans", value: "9", note: "Paketi calisan firmalar" },
  { label: "Pending domains", value: "3", note: "Manuel dogrulama bekliyor" },
  { label: "Requests today", value: "27", note: "Bugun gelen teklif talepleri" },
];

export default async function SuperAdminPage() {
  await requireRole("SUPER_ADMIN");
  const [businessLoad, plans] = await Promise.all([
    loadSuperAdminBusinesses(),
    listPlans(),
  ]);
  const businesses = businessLoad.businesses;
  const overviewMetrics = [
    { ...metrics[0], value: String(businessLoad.totalCount) },
    { ...metrics[1], value: String(plans.filter((plan) => plan.active).length) },
    metrics[2],
    metrics[3],
  ];

  return (
    <section className="grid gap-6">
      <div id="overview" className="grid gap-4 lg:grid-cols-4">
        {overviewMetrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-[24px] border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-500">{metric.label}</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-slate-600">{metric.note}</p>
          </article>
        ))}
      </div>

      <div id="businesses" className="grid gap-6">
        <BusinessCreateForm />

        {businessLoad.error ? (
          <article className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-rose-900">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-700">
              Supabase business fetch hatasi
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight">
              İşletmeler listesi okunamadı
            </h3>
            <p className="mt-2 text-sm leading-7 text-rose-800">
              {businessLoad.error.message}
            </p>
            <p className="mt-2 text-xs text-rose-700">
              Code: {businessLoad.error.code} · Status: {businessLoad.error.status}
            </p>
          </article>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {businesses.map((business) => (
            <SuperAdminBusinessCard key={business.id} business={business} />
          ))}
        </div>

        <article
          id="settings"
          className="rounded-[24px] border border-orange-200 bg-orange-50 p-6"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">
            Guard
          </p>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Bu sayfa sadece SUPER_ADMIN icin acik.
          </h3>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Business admin bu alana giremez; kendi businessId verisi ile sadece
            kendi panelini gorur.
          </p>
        </article>
      </div>
    </section>
  );
}
