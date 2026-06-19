import type { ReservationRecord } from "@/lib/reservation-types";
import type { BusinessVoucherRecord } from "@/lib/vouchers";

export type VoucherWhatsAppTemplate = {
  body: string;
  preview: string;
  recipient: string;
};

export function buildVoucherWhatsAppTemplate(
  reservation: ReservationRecord,
  voucher: BusinessVoucherRecord,
  options?: {
    voucherLink?: string;
    businessName?: string;
  },
): VoucherWhatsAppTemplate {
  const voucherLink = options?.voucherLink?.trim() || "{{voucher_link}}";
  const businessName = options?.businessName?.trim() || voucher.businessName;
  const travelDate = String(reservation.travelDate ?? "").trim() || "-";
  const travelTime = String(reservation.travelTime ?? "").trim() || "-";
  const origin = String(reservation.origin ?? "").trim() || "-";
  const destination = String(reservation.destination ?? "").trim() || "-";

  const body = [
    `Merhaba ${reservation.customerName},`,
    "",
    `${businessName} rezervasyonunuz hazır.`,
    `Rezervasyon No: ${voucher.documentNo}`,
    `Tarih/Saat: ${travelDate} ${travelTime}`,
    `Nereden/Nereye: ${origin} → ${destination}`,
    `Voucher: ${voucherLink}`,
  ].join("\n");

  return {
    body,
    preview: body,
    recipient: reservation.phone?.trim() || "",
  };
}
