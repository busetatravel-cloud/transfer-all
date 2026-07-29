import { notFound } from "next/navigation";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";
import { getPaymentByReservationId } from "@/lib/payments";
import { getReservationById } from "@/lib/reservation-service";
import { CheckoutPaymentPanel } from "@/components/checkout-payment-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const session = await requireBusinessSession();
  const { reservationId } = await params;
  const [business, reservation, payment] = await Promise.all([
    getBusinessById(session.businessId),
    getReservationById(session.businessId, reservationId),
    getPaymentByReservationId(session.businessId, reservationId),
  ]);

  if (!business || !reservation) {
    notFound();
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#ecfeff_100%)] p-6 shadow-sm lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Checkout & Payment Engine
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="grid gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              Checkout
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Rezervasyon özeti, ödeme oluşturma ve ödeme tamamlama akışı burada yönetilir.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
            <div className="font-medium text-slate-950">{business.name}</div>
            <div className="mt-1">Reservation ID: {reservation.id}</div>
            <div>Currency: {reservation.currency ?? "TRY"}</div>
          </div>
        </div>
      </article>

      <CheckoutPaymentPanel reservation={reservation} initialPayment={payment} />
    </section>
  );
}

