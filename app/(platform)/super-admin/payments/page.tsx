import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";
import { listPayments } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function SuperAdminPaymentsPage() {
  await requireRole("SUPER_ADMIN");

  const payments = await listPayments();
  const businessIds = Array.from(new Set(payments.map((item) => item.businessId)));
  const businessEntries = await Promise.all(
    businessIds.map(async (businessId) => {
      const business = await getBusinessById(businessId);
      return [businessId, business?.name ?? businessId] as const;
    }),
  );
  const businessNameMap = new Map(businessEntries);

  return (
    <section className="grid gap-6">
      <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Super Admin Payments
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Tüm tenant ödemeleri
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
          Super admin tüm business kayıtlarını ve ödeme durumlarını tenant izolasyonunu bozmadan
          izleyebilir.
        </p>
      </article>

      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
          <table className="min-w-[1400px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <Th>Business</Th>
                <Th>Payment ID</Th>
                <Th>Reservation ID</Th>
                <Th>Provider</Th>
                <Th>Status</Th>
                <Th>Amount</Th>
                <Th>Currency</Th>
                <Th>Transaction Ref</Th>
                <Th>Created</Th>
                <Th>Checkout</Th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-slate-200">
                    <Td>{businessNameMap.get(payment.businessId) ?? payment.businessId}</Td>
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
                  <td className="border-t border-slate-200 px-4 py-6 text-sm text-slate-500" colSpan={10}>
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

function Th({ children }: { children: string }) {
  return <th className="px-4 py-3">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 text-slate-700">{children}</td>;
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + ` ${currency}`;
}
