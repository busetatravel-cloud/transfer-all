import type { ReservationRecord } from "@/lib/reservation-types";
import type { BusinessVoucherRecord } from "@/lib/vouchers";

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
  },
): VoucherMailTemplate {
  const voucherLink = options?.voucherLink?.trim() || buildVoucherLinkPlaceholder(voucher.id);
  const businessName = options?.businessName?.trim() || voucher.businessName;
  const subject = `Rezervasyon Onayı - ${reservation.customerName}`;
  const body = [
    renderLine("Müşteri", reservation.customerName),
    renderLine("Rezervasyon No", voucher.documentNo),
    renderLine(
      "Tarih/Saat",
      `${renderValue(reservation.travelDate)} ${renderValue(reservation.travelTime, "")}`.trim(),
    ),
    renderLine("Telefon", renderValue(reservation.phone)),
    renderLine("Nereden", renderValue(reservation.origin)),
    renderLine("Nereye", renderValue(reservation.destination)),
    renderLine("Voucher Link", voucherLink),
    "",
    "Saygılarımızla",
    businessName,
  ].join("\n");

  return {
    subject,
    body,
    preview: `${subject}\n\n${body}`,
    recipient: reservation.email?.trim() || "",
  };
}
