import type { ReservationRecord } from "@/lib/reservation-types";
import type { BusinessVoucherRecord } from "@/lib/vouchers";
import type { VoucherCopy } from "@/lib/public-copy";

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
    copy?: VoucherCopy;
  },
): VoucherWhatsAppTemplate {
  const voucherLink = options?.voucherLink?.trim() || "{{voucher_link}}";
  const businessName = options?.businessName?.trim() || voucher.businessName;
  const copy = options?.copy;
  const travelDate = String(reservation.travelDate ?? "").trim() || "-";
  const travelTime = String(reservation.travelTime ?? "").trim() || "-";
  const origin = String(reservation.origin ?? "").trim() || "-";
  const destination = String(reservation.destination ?? "").trim() || "-";

  const body = [
    `${copy?.whatsappGreeting ?? "Merhaba"} ${reservation.customerName},`,
    "",
    `${businessName} ${copy?.whatsappReady ?? "rezervasyonunuz hazır."}`,
    `${copy?.whatsappReservationNo ?? "Rezervasyon No"}: ${voucher.documentNo}`,
    `${copy?.whatsappDateTime ?? "Tarih/Saat"}: ${travelDate} ${travelTime}`,
    `${copy?.whatsappOriginDestination ?? "Nereden/Nereye"}: ${origin} → ${destination}`,
    `${copy?.whatsappVoucher ?? "Voucher"}: ${voucherLink}`,
  ].join("\n");

  return {
    body,
    preview: body,
    recipient: reservation.phone?.trim() || "",
  };
}

