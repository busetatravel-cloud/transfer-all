export const BOOKING_STATUS_OPTIONS = [
  "Bekliyor",
  "Onaylandı",
  "Şoför Atandı",
  "Tamamlandı",
  "İptal",
] as const;

export type BookingStatus = (typeof BOOKING_STATUS_OPTIONS)[number];

export function formatBookingStatusLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "Bekliyor";
  }

  if (BOOKING_STATUS_OPTIONS.includes(normalized as BookingStatus)) {
    return normalized as BookingStatus;
  }

  const map: Record<string, BookingStatus> = {
    new: "Bekliyor",
    in_progress: "Şoför Atandı",
    completed: "Tamamlandı",
    archived: "İptal",
    "OnaylandÄ±": "Onaylandı",
    "ÅofÃ¶r AtandÄ±": "Şoför Atandı",
    "TamamlandÄ±": "Tamamlandı",
    "Ä°ptal": "İptal",
  };

  return map[normalized] ?? map[normalized.toLowerCase()] ?? "Bekliyor";
}

export const PAYMENT_STATUS_OPTIONS = [
  "Ödenmedi",
  "Kapora Alındı",
  "Ödendi",
  "Araçta Tahsil",
  "İade",
  "İptal",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_OPTIONS)[number];

export function formatPaymentStatusLabel(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "Ödenmedi";
  }

  if (PAYMENT_STATUS_OPTIONS.includes(normalized as PaymentStatus)) {
    return normalized as PaymentStatus;
  }

  const map: Record<string, PaymentStatus> = {
    unpaid: "Ödenmedi",
    new: "Ödenmedi",
    odenmedi: "Ödenmedi",
    deposit: "Kapora Alındı",
    kapora_alindi: "Kapora Alındı",
    paid: "Ödendi",
    odendi: "Ödendi",
    cash: "Araçta Tahsil",
    aracta_tahsil: "Araçta Tahsil",
    refund: "İade",
    iade: "İade",
    canceled: "İptal",
    cancelled: "İptal",
    iptal: "İptal",
    archived: "İptal",
    "Ã–denmedi": "Ödenmedi",
    "Kapora AlÄ±ndÄ±": "Kapora Alındı",
    "Ã–dendi": "Ödendi",
    "AraÃ§ta Tahsil": "Araçta Tahsil",
    "Ä°ade": "İade",
    "Ä°ptal": "İptal",
  };

  return map[normalized] ?? map[normalized.toLowerCase()] ?? "Ödenmedi";
}
