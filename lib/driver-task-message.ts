import type { OperationReservationRecord } from "@/lib/operation-types";

export type DriverTaskFieldKey =
  | "passengerName"
  | "phone"
  | "pax"
  | "pickupDate"
  | "pickupTime"
  | "pickupPoint"
  | "dropoffPoint"
  | "flightCode"
  | "flightTime"
  | "hotel"
  | "roomNo"
  | "paymentStatus"
  | "collectedAmount"
  | "operationNote"
  | "customerNote";

export type DriverTaskFieldSelection = Record<DriverTaskFieldKey, boolean>;

export type DriverTaskFieldDefinition = {
  key: DriverTaskFieldKey;
  label: string;
  defaultChecked: boolean;
};

export const DRIVER_TASK_FIELD_DEFINITIONS: DriverTaskFieldDefinition[] = [
  { key: "passengerName", label: "Yolcu Adı", defaultChecked: true },
  { key: "phone", label: "Telefon", defaultChecked: true },
  { key: "pax", label: "Yolcu Sayısı (Pax)", defaultChecked: true },
  { key: "pickupDate", label: "Pickup Tarihi", defaultChecked: true },
  { key: "pickupTime", label: "Pickup Saati", defaultChecked: true },
  { key: "pickupPoint", label: "Pickup Noktası", defaultChecked: true },
  { key: "dropoffPoint", label: "Dropoff Noktası", defaultChecked: true },
  { key: "flightCode", label: "Uçuş Kodu", defaultChecked: false },
  { key: "flightTime", label: "Uçuş Saati", defaultChecked: false },
  { key: "hotel", label: "Otel", defaultChecked: false },
  { key: "roomNo", label: "Oda No", defaultChecked: false },
  { key: "paymentStatus", label: "Ödeme Durumu", defaultChecked: false },
  { key: "collectedAmount", label: "Araçta Tahsil Edilecek", defaultChecked: false },
  { key: "operationNote", label: "Operasyon Notu", defaultChecked: false },
  { key: "customerNote", label: "Müşteri Notu", defaultChecked: false },
];

export const DRIVER_TASK_FIELD_KEYS: DriverTaskFieldKey[] = DRIVER_TASK_FIELD_DEFINITIONS.map(
  (field) => field.key,
);

export function createDriverTaskSelection(value: boolean): DriverTaskFieldSelection {
  return DRIVER_TASK_FIELD_DEFINITIONS.reduce((accumulator, field) => {
    accumulator[field.key] = value;
    return accumulator;
  }, {} as DriverTaskFieldSelection);
}

export function createDefaultDriverTaskSelection(): DriverTaskFieldSelection {
  return DRIVER_TASK_FIELD_DEFINITIONS.reduce((accumulator, field) => {
    accumulator[field.key] = field.defaultChecked;
    return accumulator;
  }, {} as DriverTaskFieldSelection);
}

function formatMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined) {
    return "";
  }

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency ?? "TRY"}`;
}

function formatPax(adultCount: number, childCount: number, babyCount: number) {
  const parts: string[] = [];

  if (adultCount > 0) {
    parts.push(`${adultCount} Yetişkin`);
  }

  if (childCount > 0) {
    parts.push(`${childCount} Çocuk`);
  }

  if (babyCount > 0) {
    parts.push(`${babyCount} Bebek`);
  }

  return parts.join(", ");
}

// Uçuş saati ve oda no için veri modelinde güvenilir bir kolon yok; bu iki alan boş kalır
// ve seçili olsalar bile mesajda satır oluşturmaz.
function buildFieldValues(reservation: OperationReservationRecord): Record<DriverTaskFieldKey, string> {
  return {
    passengerName: reservation.passengerName || reservation.customerName || "",
    phone: reservation.phone ?? "",
    pax: formatPax(reservation.adultCount, reservation.childCount, reservation.babyCount),
    pickupDate: reservation.travelDate ?? "",
    pickupTime: reservation.pickupTime || reservation.travelTime || "",
    pickupPoint: reservation.origin ?? "",
    dropoffPoint: reservation.destination ?? "",
    flightCode: reservation.flightCode ?? "",
    flightTime: "",
    hotel: reservation.hotelNameOrAddress ?? "",
    roomNo: "",
    paymentStatus: reservation.paymentStatus ?? "",
    collectedAmount: formatMoney(reservation.collectedAmount, reservation.currency),
    operationNote: reservation.operationNotes ?? "",
    customerNote: reservation.notes ?? "",
  };
}

export function buildDriverTaskMessage(
  reservation: OperationReservationRecord,
  selection: DriverTaskFieldSelection,
  driverName: string,
) {
  const values = buildFieldValues(reservation);
  const lines: string[] = [`Merhaba ${driverName || "Şoför"},`, "", "Yeni transfer görevi:"];

  for (const field of DRIVER_TASK_FIELD_DEFINITIONS) {
    if (!selection[field.key]) {
      continue;
    }

    const value = values[field.key].trim();

    if (!value) {
      continue;
    }

    lines.push(`${field.label}: ${value}`);
  }

  return lines.join("\n");
}
