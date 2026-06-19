/* eslint-disable @next/next/no-img-element */

import { notFound } from "next/navigation";
import { requireBusinessSession } from "@/lib/auth";
import { getReservationById } from "@/lib/reservation-service";
import {
  ensureBusinessVoucherForReservation,
  type BusinessVoucherRecord,
} from "@/lib/vouchers";
import { RESERVATION_LABELS } from "@/lib/reservation-ui";
import { VoucherActions } from "@/components/voucher-actions";
import { VoucherDeliveryPanel } from "@/components/voucher-delivery-panel";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function renderValue(value: string | number | null | undefined) {
  const safe = String(value ?? "").trim();
  return safe || "-";
}

function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency ?? "TRY"}`;
}

function formatPassengerCount(voucher: BusinessVoucherRecord) {
  return `${voucher.passengerCount}`;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</div>
      <div className="text-sm leading-6 text-slate-500">{description}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[18px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="text-sm font-medium leading-6 text-slate-950">{value}</div>
    </div>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="text-sm font-semibold text-slate-950">{value}</div>
    </div>
  );
}

export default async function ReservationVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireBusinessSession();
  const { id } = await params;

  const reservation = await getReservationById(session.businessId, id);

  if (!reservation) {
    notFound();
  }

  const voucher = await ensureBusinessVoucherForReservation(session.businessId, id);

  if (!voucher) {
    notFound();
  }

  const displayLanguage = String(voucher.language ?? reservation.language ?? "tr").toLowerCase();
  const qrLabel = RESERVATION_LABELS.qrPlaceholder;

  return (
    <main className="voucher-print-shell min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#eef2ff_45%,_#ffffff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-slate-200 bg-white/85 px-5 py-4 shadow-sm backdrop-blur"
          data-no-print
        >
          <div className="grid gap-1">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
              {RESERVATION_LABELS.voucherPreview}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
              Voucher önizleme
            </h1>
            <div className="text-sm text-slate-500">Dil: {displayLanguage}</div>
          </div>

          <VoucherActions backHref="/app/reservations" />
        </div>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <article
            className="grid gap-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] print:shadow-none"
            id="voucher-print-area"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {voucher.businessLogoUrl ? (
                    <img
                      alt={voucher.businessName}
                      className="h-full w-full object-contain"
                      src={voucher.businessLogoUrl}
                    />
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      LOGO
                    </span>
                  )}
                </div>
                <div className="grid gap-1">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    {voucher.businessName}
                  </div>
                  <div className="text-3xl font-semibold tracking-tight text-slate-950">
                    Voucher
                  </div>
                  <div className="text-sm text-slate-500">Dil: {displayLanguage}</div>
                </div>
              </div>

              <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Belge no
                </div>
                <div className="text-lg font-semibold text-slate-950">{voucher.documentNo}</div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-5">
                <section className="grid gap-4">
                  <SectionTitle
                    title="Müşteri bilgisi"
                    description="Rezervasyon sahibinin temel iletişim bilgileri."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label={RESERVATION_LABELS.customerName} value={voucher.customerName} />
                    <InfoCard label={RESERVATION_LABELS.phone} value={renderValue(voucher.phone)} />
                    <InfoCard label={RESERVATION_LABELS.email} value={renderValue(voucher.email)} />
                    <InfoCard label="Ülke" value={renderValue(reservation.country)} />
                  </div>
                </section>

                <section className="grid gap-4">
                  <SectionTitle
                    title="Transfer bilgisi"
                    description="Rota, tarih, saat ve operasyon detayları."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label="Nereden" value={renderValue(voucher.origin)} />
                    <InfoCard label="Nereye" value={renderValue(voucher.destination)} />
                    <InfoCard label="Transfer tipi" value={renderValue(voucher.transferType)} />
                    <InfoCard label={RESERVATION_LABELS.flightCode} value={renderValue(voucher.flightCode)} />
                    <InfoCard label={RESERVATION_LABELS.vehicleName} value={renderValue(voucher.vehicleName)} />
                    <InfoCard label={RESERVATION_LABELS.date} value={renderValue(voucher.travelDate)} />
                    <InfoCard label={RESERVATION_LABELS.time} value={renderValue(voucher.travelTime)} />
                    <InfoCard label={RESERVATION_LABELS.status} value={renderValue(voucher.bookingStatus)} />
                  </div>
                </section>
              </div>

              <div className="grid gap-4">
                <section className="grid gap-4">
                  <SectionTitle
                    title="Yolcu bilgisi"
                    description="Kapasite ve yolcu dağılımı."
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoCard label={RESERVATION_LABELS.adults} value={renderValue(reservation.adultCount)} />
                    <InfoCard label={RESERVATION_LABELS.children} value={renderValue(reservation.childCount)} />
                    <InfoCard label={RESERVATION_LABELS.infants} value={renderValue(reservation.babyCount)} />
                    <InfoCard label="Toplam yolcu" value={formatPassengerCount(voucher)} />
                  </div>
                </section>

                <section className="grid gap-4">
                  <SectionTitle
                    title="Ödeme bilgisi"
                    description="Tutar, kapora ve kalan bakiye."
                  />
                  <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <MoneyRow
                      label={RESERVATION_LABELS.total}
                      value={formatMoney(voucher.totalAmount, voucher.currency)}
                    />
                    <MoneyRow
                      label={RESERVATION_LABELS.deposit}
                      value={formatMoney(voucher.depositAmount, voucher.currency)}
                    />
                    <MoneyRow
                      label={RESERVATION_LABELS.remaining}
                      value={formatMoney(voucher.remainingAmount, voucher.currency)}
                    />
                    <MoneyRow
                      label={RESERVATION_LABELS.currency}
                      value={renderValue(voucher.currency)}
                    />
                    <MoneyRow
                      label={RESERVATION_LABELS.paymentStatus}
                      value={renderValue(reservation.paymentStatus)}
                    />
                  </div>
                </section>

                <section className="grid gap-4">
                  <SectionTitle
                    title="QR alanı"
                    description="Şimdilik sadece yer tutucu gösterilir."
                  />
                  <div className="grid aspect-square place-items-center rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-6">
                    <div className="grid gap-3 text-center">
                      <div className="mx-auto grid h-36 w-36 place-items-center rounded-[28px] border border-slate-300 bg-white text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                        QR
                      </div>
                      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {qrLabel}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <section className="grid gap-4 border-t border-slate-200 pt-5">
              <SectionTitle
                title="Notlar"
                description="Rezervasyon ve operasyon notları."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    {RESERVATION_LABELS.notes}
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-700">
                    {voucher.notes.trim() ? voucher.notes : "-"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Operasyon notu
                  </div>
                  <div className="mt-2 text-sm leading-7 text-slate-700">
                    {reservation.operationNotes?.trim() ? reservation.operationNotes : "-"}
                  </div>
                </div>
              </div>
            </section>
          </article>

          <aside className="grid gap-6 print:hidden" data-no-print>
            <article className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">Bilgi</div>
              <div className="grid gap-2 text-sm text-slate-600">
                <div>Rezervasyon ID: {reservation.id}</div>
                <div>Business ID: {session.businessId}</div>
                <div>Voucher ID: {voucher.id}</div>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                Bu ekran HTML önizleme olarak çalışır. Yazdır ve PDF indir butonları tarayıcı
                print diyaloğunu açar.
              </div>
            </article>

            <VoucherDeliveryPanel reservation={reservation} voucher={voucher} />
          </aside>
        </section>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm;
          }

          body * {
            visibility: hidden !important;
          }

          #voucher-print-area,
          #voucher-print-area * {
            visibility: visible !important;
          }

          #voucher-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }

          .voucher-print-shell {
            background: #fff !important;
          }

          [data-no-print] {
            display: none !important;
          }
        }
      `}</style>
    </main>
  );
}
