import Link from "next/link";
import { ReservationsModule } from "@/components/reservations-module";
import { requireBusinessSession } from "@/lib/auth";
import { listReservations } from "@/lib/reservation-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReservationsPage() {
  const session = await requireBusinessSession();
  const reservations = await listReservations(session.businessId);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-1">
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Reservations
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
            Rezervasyonlar ve yeni transfer oluşturma
          </h1>
          <p className="text-sm text-slate-600">
            Listeyi yönet, yeni transfer rezervasyonu oluştur ve voucher akışına bağla.
          </p>
        </div>

        <Link
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          href="/app/reservations/new"
        >
          Yeni rezervasyon
        </Link>
      </div>

      <ReservationsModule businessId={session.businessId} initialReservations={reservations} />
    </section>
  );
}
