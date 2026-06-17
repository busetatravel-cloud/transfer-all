import { BusinessPanelEditor } from "@/components/business-panel-editor";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessPanelData } from "@/lib/business-panel";

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
            Bu oturum için eşleşen business verisi yok. Panel, yalnızca kendi
            businessId kaydını gösterir.
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
              {panel.business?.name ?? "Business"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Sadece kendi businessId kaydini duzenleyen sade panel çekirdeği.
              Veri, session baglantisiyla sunucu tarafinda ayrıştırılır.
            </p>
          </div>
          <dl className="grid gap-3 text-sm text-slate-600">
            <Detail label="Session email" value={session.email} />
            <Detail label="Business email" value={panel.business?.email ?? "-"} />
            <Detail label="Business domain" value={panel.business?.domain ?? "Not set"} />
            <Detail label="Logo URL" value={panel.business?.logoUrl ?? "Empty"} />
          </dl>
        </div>
      </article>

      <BusinessPanelEditor panel={panel} />

      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Talepler
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Public form kayıtları
            </h2>
          </div>
          <p className="text-sm text-slate-600">
            Kayıtlar yalnızca bu businessId için gösterilir.
          </p>
        </div>

        <div className="mt-5 grid gap-3">
          {panel.requests.length ? (
            panel.requests.map((request) => (
              <div
                key={request.id}
                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[0.9fr_1.1fr]"
              >
                <div className="grid gap-1 text-sm">
                  <p className="font-semibold text-slate-900">
                    {request.customerName}
                  </p>
                  <p className="text-slate-600">{request.phone ?? "-"}</p>
                  <p className="text-slate-600">{request.email ?? "-"}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    {request.status}
                  </p>
                </div>
                <p className="text-sm leading-7 text-slate-600">
                  {request.message}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              Henüz gelen talep yok.
            </div>
          )}
        </div>
      </article>
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
