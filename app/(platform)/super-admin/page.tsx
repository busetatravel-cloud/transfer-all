import { BusinessCreateForm } from "@/components/business-create-form";
import { DomainUpdateForm } from "@/components/domain-update-form";
import { listBusinesses } from "@/lib/business";
import { requireRole } from "@/lib/auth";

const metrics = [
  { label: "Businesses", value: "12", note: "Aktif hesap sayisi" },
  { label: "Active plans", value: "9", note: "Paketi calisan firmalar" },
  { label: "Pending domains", value: "3", note: "Manuel dogrulama bekliyor" },
  { label: "Requests today", value: "27", note: "Bugun gelen teklif talepleri" },
];

export default async function SuperAdminPage() {
  await requireRole("SUPER_ADMIN");
  const businesses = await listBusinesses();
  const overviewMetrics = [
    { ...metrics[0], value: String(businesses.length) },
    metrics[1],
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

        <div className="grid gap-4 lg:grid-cols-2">
          {businesses.map((business) => (
            <article
              key={business.id}
              className="rounded-[24px] border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Business
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">
                    {business.name}
                  </h3>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {business.active ? "Active" : "Passive"}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm text-slate-600">
                <Detail label="Business email" value={business.email} />
                <Detail label="Admin login" value="Primary BUSINESS_ADMIN" />
                <Detail label="Domain" value={business.domain ?? "Not set"} />
                <Detail label="Status" value={business.domainStatus} />
              </dl>

              <div className="mt-5 border-t border-slate-200 pt-5">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Domain sekmesi
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Public site eşleşmesi ve manuel doğrulama bu alandan yönetilir.
                </p>
                <div className="mt-4">
                  <DomainUpdateForm
                    businessId={business.id}
                    domain={business.domain}
                    domainStatus={business.domainStatus}
                  />
                </div>
              </div>
            </article>
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
