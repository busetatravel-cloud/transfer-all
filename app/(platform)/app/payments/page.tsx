import Link from "next/link";
import type { ReactNode } from "react";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";
import { listPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function BusinessPaymentsPage() {
  const session = await requireBusinessSession();
  const [business, payments] = await Promise.all([
    getBusinessById(session.businessId),
    listPayments(session.businessId),
  ]);

  const summary = {
    total: payments.length,
    pending: payments.filter((item) => item.status === "Pending").length,
    paid: payments.filter((item) => item.status === "Paid").length,
    partial: payments.filter((item) => item.status === "Partially Paid").length,
    failed: payments.filter((item) => item.status === "Failed").length,
  };

  return (
    <section className="grid gap-6">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Payments</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Ödemeler</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Business admin sadece kendi tenant ödemelerini görür. Checkout akışındaki durumlar
              burada tek tabloda takip edilir.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div className="font-medium text-slate-950">{business?.name ?? "Business"}</div>
            <div className="mt-1">Business ID: {session.businessId}</div>
          </div>
        </div>
      </article>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="Toplam" value={String(summary.total)} />
        <Metric label="Bekleyen" value={String(summary.pending)} />
        <Metric label="Ödendi" value={String(summary.paid)} />
        <Metric label="Kısmi" value={String(summary.partial)} />
        <Metric label="Başarısız" value={String(summary.failed)} />
      </div>

      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">Ödeme kayıtları</h2>
            <p className="mt-1 text-sm text-slate-600">
              Status, provider, amount ve ödeme tarihi.
            </p>
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
            href="/app/reservations"
          >
            Rezervasyonlara git
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
          <table className="min-w-[1200px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <Th>Payment ID</Th>
                <Th>Reservation ID</Th>
                <Th>Provider</Th>
                <Th>Status</Th>
                <Th>Amount</Th>
                <Th>Currency</Th>
                <Th>Transaction Ref</Th>
                <Th>Created</Th>
                <Th className="no-print">Checkout</Th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-200">
                    <Td>{payment.id}</Td>
                    <Td>{payment.reservationId}</Td>
                    <Td>{payment.provider}</Td>
                    <Td>{payment.status}</Td>
                    <Td>{formatMoney(payment.amount, payment.currency)}</Td>
                    <Td>{payment.currency}</Td>
                    <Td>{payment.transactionReference ?? "-"}</Td>
                    <Td>{payment.createdAt.slice(0, 19).replace("T", " ")}</Td>
                    <Td>
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                        href={`/app/checkout/${payment.reservationId}`}
                      >
                        Aç
                      </Link>
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="border-t border-slate-200 px-4 py-6 text-sm text-slate-500" colSpan={9}>
                    Henüz ödeme kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

function Th({ children, className = "" }: { children: string; className?: string }) {
  return <th className={`px-4 py-3 ${className}`.trim()}>{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 text-slate-700">{children}</td>;
}

function formatMoney(value: number, currency: string) {
  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}
