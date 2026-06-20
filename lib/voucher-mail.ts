import type { ReservationRecord } from "@/lib/reservation-types";
import type { BusinessVoucherRecord } from "@/lib/vouchers";
import type { VoucherCopy } from "@/lib/public-copy";

export type VoucherMailTemplate = {
  subject: string;
  body: string;
  preview: string;
  recipient: string;
};

export function buildVoucherLinkPlaceholder(voucherId: string) {
  void voucherId;
  return "{{voucher_link}}";
}

function renderLine(label: string, value: string) {
  return `${label}: ${value}`;
}

function renderValue(value: string | number | null | undefined, fallback = "-") {
  const safe = String(value ?? "").trim();
  return safe || fallback;
}

export function buildVoucherMailTemplate(
  reservation: ReservationRecord,
  voucher: BusinessVoucherRecord,
  options?: {
    voucherLink?: string;
    businessName?: string;
    copy?: VoucherCopy;
  },
): VoucherMailTemplate {
  const voucherLink = options?.voucherLink?.trim() || buildVoucherLinkPlaceholder(voucher.id);
  const businessName = options?.businessName?.trim() || voucher.businessName;
  const copy = options?.copy;
  const subject = `${copy?.mailSubject ?? "Rezervasyon Onayı"} - ${reservation.customerName}`;
  const body = [
    renderLine(copy?.mailGreeting ?? "Merhaba", reservation.customerName),
    renderLine(copy?.mailReservationNo ?? "Rezervasyon No", voucher.documentNo),
    renderLine(
      copy?.mailDateTime ?? "Tarih/Saat",
      `${renderValue(reservation.travelDate)} ${renderValue(reservation.travelTime, "")}`.trim(),
    ),
    renderLine(copy?.mailPhone ?? "Telefon", renderValue(reservation.phone)),
    renderLine(copy?.mailOrigin ?? "Nereden", renderValue(reservation.origin)),
    renderLine(copy?.mailDestination ?? "Nereye", renderValue(reservation.destination)),
    renderLine(copy?.mailVoucherLink ?? "Voucher Link", voucherLink),
    "",
    copy?.mailClosing ?? "Saygılarımızla",
    businessName,
  ].join("\n");

  return {
    subject,
    body,
    preview: `${subject}\n\n${body}`,
    recipient: reservation.email?.trim() || "",
  };
}

