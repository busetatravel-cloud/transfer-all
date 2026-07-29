import Link from "next/link";
import { notFound } from "next/navigation";
import { TransferReservationEngine } from "@/components/transfer-reservation-engine/transfer-reservation-engine";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewReservationPage() {
  const session = await requireBusinessSession();
  const business = await getBusinessById(session.businessId);

  if (!business) {
    notFound();
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-1">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Transfer Engine
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            {business.name} için yeni rezervasyon
          </h1>
          <p className="text-sm text-slate-600">
            Bu ekran, ilk sürüm transfer rezervasyonlarını doğrudan kaydeder ve ileri aşama
            fiyat/ödeme akışlarına hazır veri üretir.
          </p>
        </div>

        <Link
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          href="/app/reservations"
        >
          Listeye dön
        </Link>
      </div>

      <TransferReservationEngine businessId={business.id} businessName={business.name} />
    </section>
  );
}
