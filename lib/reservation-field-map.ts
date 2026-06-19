export const RESERVATION_CREATE_FIELD_MAP = {
  customerName: "customer_name",
  phone: "phone",
  email: "email",
  country: "country",
  language: "language",
  from: "from_location",
  to: "to_location",
  date: "travel_date",
  time: "travel_time",
  flightCode: "flight_code",
  adults: "adult_count",
  children: "child_count",
  babies: "baby_count",
  vehicleCategory: "vehicle_category",
  vehicle: "vehicle_name",
} as const;

export type ReservationCreateUiField = keyof typeof RESERVATION_CREATE_FIELD_MAP;
export type ReservationCreateApiField =
  (typeof RESERVATION_CREATE_FIELD_MAP)[ReservationCreateUiField];

const API_TO_UI_FIELD_MAP = Object.fromEntries(
  Object.entries(RESERVATION_CREATE_FIELD_MAP).map(([uiField, apiField]) => [
    apiField,
    uiField,
  ]),
) as Record<ReservationCreateApiField, ReservationCreateUiField>;

function normalizeText(value: unknown) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function normalizeOptionalText(value: unknown) {
  const safe = normalizeText(value);
  return safe || undefined;
}

function normalizeCount(value: unknown) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function normalizeAmount(value: unknown) {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function mapReservationApiFieldErrorsToUi(
  fieldErrors: Record<string, string> | undefined,
) {
  if (!fieldErrors) {
    return {};
  }

  const mapped: Record<string, string> = {};

  for (const [apiField, message] of Object.entries(fieldErrors)) {
    const uiField = API_TO_UI_FIELD_MAP[apiField as ReservationCreateApiField];
    mapped[uiField ?? apiField] = message;
  }

  return mapped;
}

export function buildReservationCreatePayload(input: {
  customerName: string;
  phone: string;
  email: string;
  country: string;
  language: string;
  from: string;
  to: string;
  date: string;
  time: string;
  flightCode: string;
  adults: string;
  children: string;
  babies: string;
  vehicleCategory: string;
  vehicle: string;
  totalAmount: string;
  depositAmount: string;
  remainingAmount: string;
  currency: string;
  notes: string;
  paymentStatus: string;
  status: string;
}) {
  return {
    customer_name: normalizeText(input.customerName),
    phone: normalizeOptionalText(input.phone),
    email: normalizeOptionalText(input.email),
    country: normalizeOptionalText(input.country),
    language: normalizeOptionalText(input.language) || "tr",
    from_location: normalizeText(input.from),
    to_location: normalizeText(input.to),
    travel_date: normalizeText(input.date),
    travel_time: normalizeText(input.time),
    flight_code: normalizeOptionalText(input.flightCode),
    adult_count: normalizeCount(input.adults),
    child_count: normalizeCount(input.children),
    baby_count: normalizeCount(input.babies),
    vehicle_category: normalizeOptionalText(input.vehicleCategory),
    vehicle_name: normalizeOptionalText(input.vehicle),
    total_amount: normalizeAmount(input.totalAmount),
    deposit_amount: normalizeAmount(input.depositAmount),
    remaining_amount: normalizeAmount(input.remainingAmount),
    currency: normalizeOptionalText(input.currency) || "TRY",
    notes: normalizeOptionalText(input.notes),
    payment_status: normalizeOptionalText(input.paymentStatus) || "Ödenmedi",
    booking_status: normalizeOptionalText(input.status) || "Bekliyor",
    source: "Manuel",
  };
}
