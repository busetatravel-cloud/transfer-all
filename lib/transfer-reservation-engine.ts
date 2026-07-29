export const TRANSFER_TRIP_TYPES = ["one_way", "round_trip"] as const;

export type TransferTripType = (typeof TRANSFER_TRIP_TYPES)[number];

export type TransferReservationFormState = {
  passengerName: string;
  phone: string;
  email: string;
  origin: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  tripType: TransferTripType;
  vehicleCategory: string;
  agencyName: string;
  currency: string;
  couponCode: string;
  adults: string;
  children: string;
  babies: string;
  flightCode: string;
  hotelNameOrAddress: string;
  notes: string;
  childSeatRequested: boolean;
  extraBaggageRequested: boolean;
  vipGreetingRequested: boolean;
  waitingMinutes: string;
  airportParkingFee: string;
  discountPercent: string;
  discountAmount: string;
};

export type TransferReservationCreateInput = {
  passengerName: string;
  phone: string;
  email: string;
  origin: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  tripType: TransferTripType;
  vehicleCategory: string;
  agencyName: string;
  currency: string;
  couponCode: string;
  adults: string;
  children: string;
  babies: string;
  flightCode: string;
  hotelNameOrAddress: string;
  notes: string;
  childSeatRequested: boolean;
  extraBaggageRequested: boolean;
  vipGreetingRequested: boolean;
  waitingMinutes: string;
  airportParkingFee: string;
  discountPercent: string;
  discountAmount: string;
};

export type TransferReservationCreatePayload = {
  customerName: string;
  passengerName: string;
  phone?: string;
  email?: string;
  origin: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  tripType: TransferTripType;
  vehicleCategory: string;
  agencyName: string;
  currency: string;
  couponCode: string;
  adultCount: number;
  childCount: number;
  babyCount: number;
  flightCode?: string;
  hotelNameOrAddress?: string;
  childSeatRequested: boolean;
  extraBaggageRequested: boolean;
  vipGreetingRequested: boolean;
  waitingMinutes: number;
  airportParkingFee: number;
  discountPercent: number;
  discountAmount: number;
  notes?: string;
  source: string;
  bookingStatus: string;
  paymentStatus: string;
};

export type TransferReservationFieldErrors = Partial<
  Record<keyof TransferReservationFormState, string>
>;

const FIELD_ERROR_MAP: Record<string, keyof TransferReservationFormState> = {
  customerName: "passengerName",
  passenger_name: "passengerName",
  passengerName: "passengerName",
  phone: "phone",
  email: "email",
  origin: "origin",
  fromLocation: "origin",
  toLocation: "destination",
  destination: "destination",
  travelDate: "travelDate",
  travel_time: "travelTime",
  travelTime: "travelTime",
  tripType: "tripType",
  trip_type: "tripType",
  vehicleCategory: "vehicleCategory",
  vehicle_category: "vehicleCategory",
  agencyName: "agencyName",
  agency_name: "agencyName",
  currency: "currency",
  couponCode: "couponCode",
  coupon_code: "couponCode",
  adults: "adults",
  adultCount: "adults",
  children: "children",
  childCount: "children",
  babies: "babies",
  babyCount: "babies",
  flightCode: "flightCode",
  hotelNameOrAddress: "hotelNameOrAddress",
  hotel_name_or_address: "hotelNameOrAddress",
  notes: "notes",
  childSeatRequested: "childSeatRequested",
  child_seat_requested: "childSeatRequested",
  extraBaggageRequested: "extraBaggageRequested",
  extra_baggage_requested: "extraBaggageRequested",
  vipGreetingRequested: "vipGreetingRequested",
  vip_greeting_requested: "vipGreetingRequested",
  waitingMinutes: "waitingMinutes",
  waiting_minutes: "waitingMinutes",
  airportParkingFee: "airportParkingFee",
  airport_parking_fee: "airportParkingFee",
  discountPercent: "discountPercent",
  discount_percent: "discountPercent",
  discountAmount: "discountAmount",
  discount_amount: "discountAmount",
};

function normalizeText(value: unknown) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function normalizeOptionalText(value: unknown) {
  const safe = normalizeText(value);
  return safe || undefined;
}

function normalizeCount(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

function parseBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function createEmptyTransferReservationFormState(): TransferReservationFormState {
  return {
    passengerName: "",
    phone: "",
    email: "",
    origin: "",
    destination: "",
    travelDate: "",
    travelTime: "",
    tripType: "one_way",
    vehicleCategory: "standard",
    agencyName: "",
    currency: "TRY",
    couponCode: "",
    adults: "1",
    children: "0",
    babies: "0",
    flightCode: "",
    hotelNameOrAddress: "",
    notes: "",
    childSeatRequested: false,
    extraBaggageRequested: false,
    vipGreetingRequested: false,
    waitingMinutes: "0",
    airportParkingFee: "0",
    discountPercent: "0",
    discountAmount: "0",
  };
}

export function formatTripTypeLabel(value: TransferTripType) {
  return value === "round_trip" ? "Gidiş / Dönüş" : "Tek Yön";
}

export function buildTransferReservationPayload(
  input: TransferReservationCreateInput,
): TransferReservationCreatePayload {
  const passengerName = normalizeText(input.passengerName);

  return {
    customerName: passengerName,
    passengerName,
    phone: normalizeOptionalText(input.phone),
    email: normalizeOptionalText(input.email),
    origin: normalizeText(input.origin),
    destination: normalizeText(input.destination),
    travelDate: normalizeText(input.travelDate),
    travelTime: normalizeText(input.travelTime),
    tripType: input.tripType,
    vehicleCategory: normalizeText(input.vehicleCategory) || "standard",
    agencyName: normalizeOptionalText(input.agencyName) ?? "",
    currency: normalizeText(input.currency) || "TRY",
    couponCode: normalizeOptionalText(input.couponCode) ?? "",
    adultCount: normalizeCount(input.adults, 1) || 1,
    childCount: normalizeCount(input.children),
    babyCount: normalizeCount(input.babies),
    flightCode: normalizeOptionalText(input.flightCode),
    hotelNameOrAddress: normalizeOptionalText(input.hotelNameOrAddress),
    childSeatRequested: Boolean(input.childSeatRequested),
    extraBaggageRequested: Boolean(input.extraBaggageRequested),
    vipGreetingRequested: Boolean(input.vipGreetingRequested),
    waitingMinutes: normalizeCount(input.waitingMinutes, 0),
    airportParkingFee: normalizeCount(input.airportParkingFee, 0),
    discountPercent: normalizeCount(input.discountPercent, 0),
    discountAmount: normalizeCount(input.discountAmount, 0),
    notes: normalizeOptionalText(input.notes),
    source: "Transfer Engine",
    bookingStatus: "Bekliyor",
    paymentStatus: "Ödenmedi",
  };
}

export function normalizeTransferReservationBody(
  body: Record<string, unknown> | null,
) {
  const passengerName = normalizeText(body?.passengerName ?? body?.customerName);
  const phone = normalizeText(body?.phone);
  const origin = normalizeText(body?.origin ?? body?.fromLocation ?? body?.from);
  const destination = normalizeText(body?.destination ?? body?.toLocation ?? body?.to);
  const travelDate = normalizeText(body?.travelDate ?? body?.date);
  const travelTime = normalizeText(body?.travelTime ?? body?.time);
  const flightCode = normalizeOptionalText(body?.flightCode);
  const hotelNameOrAddress = normalizeOptionalText(body?.hotelNameOrAddress);
  const notes = normalizeOptionalText(body?.notes ?? body?.note);
  const tripTypeRaw = normalizeText(body?.tripType);
  const tripType: TransferTripType =
    tripTypeRaw === "round_trip"
      ? "round_trip"
      : tripTypeRaw === "one_way" || tripTypeRaw === ""
        ? "one_way"
        : "one_way";
  const vehicleCategory =
    normalizeText(body?.vehicleCategory ?? body?.vehicle_category) || "standard";
  const agencyName = normalizeText(body?.agencyName ?? body?.agency_name);
  const currency = normalizeText(body?.currency).toUpperCase();
  const couponCode = normalizeText(body?.couponCode ?? body?.coupon_code);
  const vipGreetingRequested = parseBoolean(
    body?.vipGreetingRequested ?? body?.vip_greeting_requested,
  );
  const waitingMinutes = normalizeCount(body?.waitingMinutes ?? body?.waiting_minutes, 0);
  const airportParkingFee = normalizeCount(
    body?.airportParkingFee ?? body?.airport_parking_fee,
    0,
  );
  const discountPercent = normalizeCount(
    body?.discountPercent ?? body?.discount_percent,
    0,
  );
  const discountAmount = normalizeCount(
    body?.discountAmount ?? body?.discount_amount,
    0,
  );

  const fieldErrors: Record<string, string> = {};

  if (!passengerName) fieldErrors.passengerName = "Yolcu adı gerekli.";
  if (!phone) fieldErrors.phone = "Telefon gerekli.";
  if (!origin) fieldErrors.origin = "Nereden alanı gerekli.";
  if (!destination) fieldErrors.destination = "Nereye alanı gerekli.";
  if (!travelDate) fieldErrors.travelDate = "Tarih gerekli.";
  if (!travelTime) fieldErrors.travelTime = "Saat gerekli.";

  if (tripTypeRaw && !TRANSFER_TRIP_TYPES.includes(tripTypeRaw as TransferTripType)) {
    fieldErrors.tripType = "Geçerli bir yol tipi seçin.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false as const,
      fieldErrors,
    };
  }

  return {
    ok: true as const,
    payload: {
      passengerName,
      phone,
      email: normalizeOptionalText(body?.email) ?? "",
      origin,
      destination,
      travelDate,
      travelTime,
      tripType,
      vehicleCategory,
      agencyName,
      currency,
      couponCode,
      adults: String(body?.adults ?? body?.adultCount ?? 1),
      children: String(body?.children ?? body?.childCount ?? 0),
      babies: String(body?.babies ?? body?.babyCount ?? 0),
      flightCode: flightCode ?? "",
      hotelNameOrAddress: hotelNameOrAddress ?? "",
      notes: notes ?? "",
      childSeatRequested: parseBoolean(body?.childSeatRequested),
      extraBaggageRequested: parseBoolean(body?.extraBaggageRequested),
      vipGreetingRequested,
      waitingMinutes: String(waitingMinutes),
      airportParkingFee: String(airportParkingFee),
      discountPercent: String(discountPercent),
      discountAmount: String(discountAmount),
    },
  };
}

export function mapTransferReservationFieldErrorsToUi(
  fieldErrors: Record<string, string> | undefined,
) {
  if (!fieldErrors) {
    return {};
  }

  const mapped: TransferReservationFieldErrors = {};

  for (const [key, message] of Object.entries(fieldErrors)) {
    const uiField =
      FIELD_ERROR_MAP[key] ??
      FIELD_ERROR_MAP[key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())];

    if (uiField) {
      mapped[uiField] = message;
      continue;
    }

    if (key in createEmptyTransferReservationFormState()) {
      mapped[key as keyof TransferReservationFormState] = message;
      continue;
    }

    mapped.passengerName = mapped.passengerName ?? message;
  }

  return mapped;
}
