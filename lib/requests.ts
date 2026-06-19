import "server-only";

import { randomUUID } from "node:crypto";
import { upsertBusinessCustomerFromReservation } from "@/lib/customers";
import { formatPaymentStatusLabel } from "@/lib/request-statuses";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import { createNotification } from "@/lib/notifications";

export type BookingStatus =
  | "Bekliyor"
  | "Onaylandı"
  | "Şoför Atandı"
  | "Tamamlandı"
  | "İptal";

export const BOOKING_STATUS_OPTIONS: BookingStatus[] = [
  "Bekliyor",
  "Onaylandı",
  "Şoför Atandı",
  "Tamamlandı",
  "İptal",
];

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
  };

  return map[normalized.toLowerCase()] ?? "Bekliyor";
}

export const PAYMENT_STATUS_OPTIONS = [
  "Ödenmedi",
  "Kapora Alındı",
  "Ödendi",
  "Araçta Tahsil",
  "İade",
  "İptal",
] as const;

export type BusinessRequestRecord = {
  id: string;
  businessId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  country: string | null;
  language: string | null;
  origin: string | null;
  destination: string | null;
  travelDate: string | null;
  travelTime: string | null;
  flightCode: string | null;
  adultCount: number;
  childCount: number;
  babyCount: number;
  adults: number;
  children: number;
  infants: number;
  vehicleCategory: string | null;
  vehicleName: string | null;
  assignedVehicle: string | null;
  driverName: string | null;
  pickupStatus: string | null;
  operationNotes: string | null;
  totalAmount: number | null;
  depositAmount: number | null;
  remainingAmount: number | null;
  currency: string | null;
  paymentStatus:
    | "Ödenmedi"
    | "Kapora Alındı"
    | "Ödendi"
    | "Araçta Tahsil"
    | "İade"
    | "İptal";
  notes: string | null;
  source: string;
  bookingStatus: BookingStatus;
  message: string;
  status: "new" | "in_progress" | "completed" | "archived";
  createdAt: string;
};

export type BusinessRequestInput = {
  customerName: string;
  phone?: string;
  email?: string;
  country?: string;
  language?: string;
  origin?: string;
  destination?: string;
  fromLocation?: string;
  toLocation?: string;
  travelDate?: string;
  travelTime?: string;
  flightCode?: string;
  adultCount?: number | string;
  childCount?: number | string;
  babyCount?: number | string;
  adults?: number | string;
  children?: number | string;
  infants?: number | string;
  vehicleCategory?: string;
  vehicleName?: string;
  vehicle?: string;
  assignedVehicle?: string;
  driverName?: string;
  totalAmount?: number | string;
  total?: number | string;
  depositAmount?: number | string;
  deposit?: number | string;
  remainingAmount?: number | string;
  remaining?: number | string;
  currency?: string;
  paymentStatus?: string;
  notes?: string;
  note?: string;
  source?: string;
  bookingStatus?: string;
  message?: string;
  pickupStatus?: string;
  operationNotes?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value?: string) {
  const safe = value?.trim().toLowerCase() ?? "";
  return safe || null;
}

function normalizeText(value?: string) {
  const safe = value?.trim() ?? "";
  return safe || null;
}

function normalizeOptionalText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || null;
}

function normalizeCount(value?: number | string) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function normalizeAmount(value?: number | string) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRequestMessage(params: {
  customerName: string;
  fromLocation: string | null;
  toLocation: string | null;
  travelDate: string | null;
  travelTime: string | null;
  fallback?: string;
}) {
  const parts = [
    params.customerName.trim(),
    [params.fromLocation, params.toLocation].filter(Boolean).join(" → "),
    [params.travelDate, params.travelTime].filter(Boolean).join(" "),
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return params.fallback ?? "Manuel rezervasyon";
  }

  return parts.join(" - ");
}

function normalizePaymentStatusValue(value?: string) {
  const normalized = formatPaymentStatusLabel(value);
  return PAYMENT_STATUS_OPTIONS.includes(
    normalized as (typeof PAYMENT_STATUS_OPTIONS)[number],
  )
    ? normalizePaymentStatus(value)
    : PAYMENT_STATUS_OPTIONS[0];
}

function normalizePaymentStatus(value?: string) {
  const normalized = value?.trim() ?? "";
  const allowed = new Set([
    "Ödenmedi",
    "Kapora Alındı",
    "Ödendi",
    "Araçta Tahsil",
    "İade",
    "İptal",
  ]);

  if (allowed.has(normalized as string)) {
    return normalized as BusinessRequestRecord["paymentStatus"];
  }

  const map: Record<string, BusinessRequestRecord["paymentStatus"]> = {
    unpaid: "Ödenmedi",
    new: "Ödenmedi",
    deposit: "Kapora Alındı",
    paid: "Ödendi",
    cash: "Araçta Tahsil",
    refund: "İade",
    canceled: "İptal",
    cancelled: "İptal",
    archived: "İptal",
  };

  return map[normalized.toLowerCase()] ?? "Ödenmedi";
}

const demoRequests = new Map<string, BusinessRequestRecord[]>([
  [
    "business-demo-1",
    [
      {
        id: "request-1",
        businessId: "business-demo-1",
        customerName: "Demo User",
        phone: "+90 555 111 22 33",
        email: "demo@example.com",
        country: "TR",
        language: "tr",
        origin: "Airport",
        destination: "Hotel",
        travelDate: "2026-06-10",
        travelTime: "10:30",
        flightCode: "TK123",
        adultCount: 2,
        childCount: 1,
        babyCount: 0,
        adults: 2,
        children: 1,
        infants: 0,
        vehicleCategory: "VIP",
        vehicleName: "VIP Van",
        assignedVehicle: "VIP Van",
        driverName: "Demo Driver",
        pickupStatus: null,
        operationNotes: null,
        totalAmount: 1200,
        depositAmount: 300,
        remainingAmount: 900,
        currency: "TRY",
        paymentStatus: "Kapora Alındı",
        notes: "Airport transfer icin teklif istiyorum.",
        source: "web",
        bookingStatus: "Bekliyor",
        message: "Airport transfer icin teklif istiyorum.",
        status: "new",
        createdAt: "2026-06-10T10:00:00.000Z",
      },
    ],
  ],
]);

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

function mapRequest(row: Record<string, unknown>): BusinessRequestRecord {
  const bookingStatus = formatBookingStatusLabel(row.booking_status as string | null);
  const driverStatus = BOOKING_STATUS_OPTIONS[2];
  const doneStatus = BOOKING_STATUS_OPTIONS[3];
  const cancelStatus = BOOKING_STATUS_OPTIONS[4];

  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    customerName: String(row.customer_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    country: (row.country as string | null) ?? null,
    language: (row.language as string | null) ?? null,
    origin: (row.from_location as string | null) ?? null,
    destination: (row.to_location as string | null) ?? null,
    travelDate: (row.travel_date as string | null) ?? null,
    travelTime: (row.travel_time as string | null) ?? null,
    flightCode: (row.flight_code as string | null) ?? null,
    adultCount: Number(row.adult_count ?? 0),
    childCount: Number(row.child_count ?? 0),
    babyCount: Number(row.baby_count ?? 0),
    adults: Number(row.adult_count ?? 0),
    children: Number(row.child_count ?? 0),
    infants: Number(row.baby_count ?? 0),
    vehicleCategory: (row.vehicle_category as string | null) ?? null,
    vehicleName: (row.vehicle_name as string | null) ?? null,
    assignedVehicle: (row.assigned_vehicle as string | null) ?? null,
    driverName: (row.driver_name as string | null) ?? null,
    pickupStatus: (row.pickup_status as string | null) ?? null,
    operationNotes: (row.operation_notes as string | null) ?? null,
    totalAmount:
      row.total_amount === null || row.total_amount === undefined
        ? null
        : Number(row.total_amount),
    depositAmount:
      row.deposit_amount === null || row.deposit_amount === undefined
        ? null
        : Number(row.deposit_amount),
    remainingAmount:
      row.remaining_amount === null || row.remaining_amount === undefined
        ? null
        : Number(row.remaining_amount),
    currency: (row.currency as string | null) ?? null,
    paymentStatus:
      (row.payment_status as BusinessRequestRecord["paymentStatus"]) ?? "Ödenmedi",
    notes: (row.notes as string | null) ?? null,
    source: (row.source as string | null) ?? "Manuel",
    bookingStatus,
    message: String(row.message ?? row.notes ?? ""),
    status:
      (row.status as BusinessRequestRecord["status"]) ??
      (bookingStatus === doneStatus
        ? "completed"
        : bookingStatus === cancelStatus
          ? "archived"
          : bookingStatus === driverStatus
            ? "in_progress"
            : "new"),
    createdAt: String(row.created_at ?? ""),
  };
}

function buildRequestPayload(businessId: string, input: BusinessRequestInput) {
  const source = normalizeText(input.source) ?? "Manuel";
  const bookingStatus = formatBookingStatusLabel(input.bookingStatus);
  const customerName = input.customerName.trim();
  const note = normalizeText(input.notes);
  const fromLocation = normalizeText(input.fromLocation ?? input.origin);
  const toLocation = normalizeText(input.toLocation ?? input.destination);
  const message =
    normalizeText(input.message) ??
    buildRequestMessage({
      customerName,
      fromLocation,
      toLocation,
      travelDate: normalizeText(input.travelDate),
      travelTime: normalizeText(input.travelTime),
      fallback: note ?? "Manuel rezervasyon",
    });

  return {
    business_id: businessId,
    customer_name: customerName,
    phone: normalizeText(input.phone),
    email: normalizeEmail(input.email),
    country: normalizeText(input.country),
    language: normalizeText(input.language),
    from_location: fromLocation,
    to_location: toLocation,
    travel_date: normalizeText(input.travelDate),
    travel_time: normalizeText(input.travelTime),
    flight_code: normalizeText(input.flightCode),
    adult_count: normalizeCount(input.adultCount ?? input.adults),
    child_count: normalizeCount(input.childCount ?? input.children),
    baby_count: normalizeCount(input.babyCount ?? input.infants),
    vehicle_category: normalizeText(input.vehicleCategory),
    vehicle_name: normalizeText(input.vehicleName),
    total_amount: normalizeAmount(input.totalAmount),
    deposit_amount: normalizeAmount(input.depositAmount),
    remaining_amount: normalizeAmount(input.remainingAmount),
    currency: normalizeText(input.currency) ?? "TRY",
    payment_status: normalizePaymentStatusValue(input.paymentStatus),
    assigned_vehicle: normalizeText(input.assignedVehicle),
    driver_name: normalizeText(input.driverName),
    pickup_status: normalizeText(input.pickupStatus),
    operation_notes: normalizeText(input.operationNotes),
    notes: note,
    source,
    booking_status: bookingStatus,
    status: "new",
    message,
  };
}

function logRequestCreateInput(
  businessId: string,
  input: BusinessRequestInput,
) {
  console.info("request.create", {
    businessId,
    customerName: String(input.customerName ?? "").trim(),
    from: normalizeOptionalText(input.origin),
    to: normalizeOptionalText(input.destination),
    date: normalizeOptionalText(input.travelDate),
    time: normalizeOptionalText(input.travelTime),
  });
}

export async function getBusinessRequests(businessId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/requests?select=id,business_id,customer_name,phone,email,country,language,from_location,to_location,travel_date,travel_time,flight_code,adult_count,child_count,baby_count,vehicle_category,vehicle_name,assigned_vehicle,driver_name,pickup_status,operation_notes,total_amount,deposit_amount,remaining_amount,currency,payment_status,notes,source,booking_status,message,status,created_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&order=created_at.desc`,
    );

    if (response?.ok) {
      const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
      return rows.map(mapRequest);
    }

    return [];
  }

  return demoRequests.get(businessId)?.slice() ?? [];
}

export async function getBusinessRequestById(
  businessId: string,
  requestId: string,
) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/requests?select=id,business_id,customer_name,phone,email,country,language,from_location,to_location,travel_date,travel_time,flight_code,adult_count,child_count,baby_count,vehicle_category,vehicle_name,assigned_vehicle,driver_name,pickup_status,operation_notes,total_amount,deposit_amount,remaining_amount,currency,payment_status,notes,source,booking_status,message,status,created_at&id=eq.${encodeURIComponent(
        requestId,
      )}&business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
    );

    if (response?.ok) {
      const rows = (await response.json().catch(() => [])) as Array<
        Record<string, unknown>
      >;
      return rows[0] ? mapRequest(rows[0]) : null;
    }

    return null;
  }

  return (
    demoRequests.get(businessId)?.find((entry) => entry.id === requestId) ?? null
  );
}

export async function createBusinessRequest(
  businessId: string,
  input: BusinessRequestInput,
) {
  logRequestCreateInput(businessId, input);
  const payload = buildRequestPayload(businessId, input);

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/requests`, {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response?.ok) {
      throw new Error("Talep kaydedilemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;

    if (rows[0]) {
      const created = mapRequest(rows[0]);
      await upsertBusinessCustomerFromReservation(businessId, {
        fullName: created.customerName,
        email: created.email ?? undefined,
        phone: created.phone ?? undefined,
        country: created.country ?? undefined,
        language: created.language ?? undefined,
        source: created.source,
        notes: created.notes ?? created.message ?? undefined,
      });
      try {
        const { syncBusinessVoucherFromRequest } = await import("./vouchers");
        await syncBusinessVoucherFromRequest(businessId, created);
      } catch (error) {
        console.warn("voucher.create.failed", {
          businessId,
          requestId: created.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      try {
        await createNotification(businessId, {
          type: "Yeni rezervasyon",
          title: `Yeni rezervasyon: ${created.customerName}`,
          message: `${created.customerName} için yeni rezervasyon oluşturuldu.`,
          relatedType: "reservation",
          relatedId: created.id,
        });
      } catch (error) {
        console.warn("notification.create.failed", {
          businessId,
          type: "Yeni rezervasyon",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return created;
    }

    throw new Error("Talep kaydı döndürülmedi.");
  }

  const record: BusinessRequestRecord = {
    id: `request-${randomUUID()}`,
    businessId,
    customerName: payload.customer_name,
    phone: payload.phone,
    email: payload.email,
    country: payload.country,
    language: payload.language,
    origin: (payload.from_location as string | null) ?? null,
    destination: (payload.to_location as string | null) ?? null,
    travelDate: payload.travel_date,
    travelTime: payload.travel_time,
    flightCode: payload.flight_code,
    adultCount: payload.adult_count,
    childCount: payload.child_count,
    babyCount: payload.baby_count,
    adults: payload.adult_count,
    children: payload.child_count,
    infants: payload.baby_count,
    vehicleCategory: payload.vehicle_category,
    vehicleName: (payload.vehicle_name as string | null) ?? null,
    assignedVehicle: null,
    driverName: null,
    pickupStatus: null,
    operationNotes: null,
    totalAmount: payload.total_amount as number | null,
    depositAmount: payload.deposit_amount as number | null,
    remainingAmount: payload.remaining_amount as number | null,
    currency: payload.currency,
    paymentStatus: payload.payment_status as BusinessRequestRecord["paymentStatus"],
    notes: payload.notes,
    source: payload.source,
    bookingStatus: payload.booking_status as BookingStatus,
    message: payload.message ?? "Manuel rezervasyon",
    status: "new",
    createdAt: nowIso(),
  };

  const current = demoRequests.get(businessId) ?? [];
  demoRequests.set(businessId, [record, ...current]);
  await upsertBusinessCustomerFromReservation(businessId, {
    fullName: record.customerName,
    email: record.email ?? undefined,
    phone: record.phone ?? undefined,
    country: record.country ?? undefined,
    language: record.language ?? undefined,
    source: record.source,
    notes: record.notes ?? record.message ?? undefined,
  });
  try {
    const { syncBusinessVoucherFromRequest } = await import("./vouchers");
    await syncBusinessVoucherFromRequest(businessId, record);
  } catch (error) {
    console.warn("voucher.create.failed", {
      businessId,
      requestId: record.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    await createNotification(businessId, {
      type: "Yeni rezervasyon",
      title: `Yeni rezervasyon: ${record.customerName}`,
      message: `${record.customerName} için yeni rezervasyon oluşturuldu.`,
      relatedType: "reservation",
      relatedId: record.id,
    });
  } catch (error) {
    console.warn("notification.create.failed", {
      businessId,
      type: "Yeni rezervasyon",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return record;
}

export async function updateBusinessRequestRecord(
  businessId: string,
  requestId: string,
  input: Partial<BusinessRequestInput> & {
    assignedVehicle?: string;
    driverName?: string;
    pickupStatus?: string;
    operationNotes?: string;
    bookingStatus?: string;
  },
) {
  const existing = hasSupabaseConnection()
    ? null
    : (demoRequests.get(businessId) ?? []).find((entry) => entry.id === requestId) ?? null;
  const nextPayload: Record<string, string | number | null> = {};

  if (input.assignedVehicle !== undefined) {
    nextPayload.assigned_vehicle = normalizeText(input.assignedVehicle);
  }

  if (input.driverName !== undefined) {
    nextPayload.driver_name = normalizeText(input.driverName);
  }

  if (input.pickupStatus !== undefined) {
    nextPayload.pickup_status = normalizeText(input.pickupStatus);
  }

  if (input.operationNotes !== undefined) {
    nextPayload.operation_notes = normalizeText(input.operationNotes);
  }

  if (input.bookingStatus !== undefined) {
    nextPayload.booking_status = formatBookingStatusLabel(input.bookingStatus);
  }

  if (input.notes !== undefined) {
    nextPayload.notes = normalizeText(input.notes);
  }

  if (input.vehicleName !== undefined) {
    nextPayload.vehicle_name = normalizeText(input.vehicleName);
  }

  if (input.vehicleCategory !== undefined) {
    nextPayload.vehicle_category = normalizeText(input.vehicleCategory);
  }

  if (input.paymentStatus !== undefined) {
    nextPayload.payment_status = normalizePaymentStatusValue(input.paymentStatus);
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/requests?id=eq.${encodeURIComponent(requestId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(nextPayload),
      },
    );

    if (!response?.ok) {
      throw new Error("Rezervasyon güncellenemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    if (rows[0]) {
      const updated = mapRequest(rows[0]);
      try {
        const { syncBusinessVoucherFromRequest } = await import("./vouchers");
        await syncBusinessVoucherFromRequest(businessId, updated);
      } catch (error) {
        console.warn("voucher.update.failed", {
          businessId,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return updated;
    }

    return null;
  }

  if (!existing) {
    throw new Error("Rezervasyon bulunamadı.");
  }

  const next: BusinessRequestRecord = {
    ...existing,
    assignedVehicle:
      (nextPayload.assigned_vehicle as string | null | undefined) ?? existing.assignedVehicle,
    driverName:
      (nextPayload.driver_name as string | null | undefined) ?? existing.driverName,
    bookingStatus:
      (nextPayload.booking_status as BookingStatus | undefined) ?? existing.bookingStatus,
    notes: (nextPayload.notes as string | null | undefined) ?? existing.notes,
    vehicleName:
      (nextPayload.vehicle_name as string | null | undefined) ?? existing.vehicleName,
    vehicleCategory:
      (nextPayload.vehicle_category as string | null | undefined) ?? existing.vehicleCategory,
    paymentStatus:
      (nextPayload.payment_status as BusinessRequestRecord["paymentStatus"] | undefined) ??
      existing.paymentStatus,
    pickupStatus:
      (nextPayload.pickup_status as string | null | undefined) ?? existing.pickupStatus,
    operationNotes:
      (nextPayload.operation_notes as string | null | undefined) ?? existing.operationNotes,
  };

  const current = demoRequests.get(businessId) ?? [];
  demoRequests.set(
    businessId,
    current.map((entry) => (entry.id === requestId ? next : entry)),
  );
  try {
    const { syncBusinessVoucherFromRequest } = await import("./vouchers");
    await syncBusinessVoucherFromRequest(businessId, next);
  } catch (error) {
    console.warn("voucher.update.failed", {
      businessId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return next;
}

export type ReservationRecord = BusinessRequestRecord;

export type ReservationInput = BusinessRequestInput;

export type ReservationUpdateInput = Partial<BusinessRequestInput> & {
  recordId: string;
};

function normalizeReservationInput(input: ReservationInput): BusinessRequestInput {
  return {
    customerName: String(input.customerName ?? "").trim(),
    phone: String(input.phone ?? "").trim() || undefined,
    email: String(input.email ?? "").trim() || undefined,
    country: String(input.country ?? "").trim() || undefined,
    language: String(input.language ?? "").trim() || undefined,
    origin: String(input.origin ?? "").trim() || undefined,
    destination: String(input.destination ?? "").trim() || undefined,
    travelDate: String(input.travelDate ?? "").trim() || undefined,
    travelTime: String(input.travelTime ?? "").trim() || undefined,
    flightCode: String(input.flightCode ?? "").trim() || undefined,
    adultCount: Number(input.adultCount ?? input.adults ?? 0),
    childCount: Number(input.childCount ?? input.children ?? 0),
    babyCount: Number(input.babyCount ?? input.infants ?? 0),
    adults: Number(input.adultCount ?? input.adults ?? 0),
    children: Number(input.childCount ?? input.children ?? 0),
    infants: Number(input.babyCount ?? input.infants ?? 0),
    vehicleCategory: String(input.vehicleCategory ?? "").trim() || undefined,
    vehicleName: String(input.vehicleName ?? "").trim() || undefined,
    assignedVehicle: String(input.assignedVehicle ?? "").trim() || undefined,
    driverName: String(input.driverName ?? "").trim() || undefined,
    totalAmount: String(input.totalAmount ?? "").trim() || undefined,
    depositAmount: String(input.depositAmount ?? "").trim() || undefined,
    remainingAmount: String(input.remainingAmount ?? "").trim() || undefined,
    currency: String(input.currency ?? "").trim() || undefined,
    paymentStatus: String(input.paymentStatus ?? "").trim() || undefined,
    notes: String(input.notes ?? "").trim() || undefined,
    source: String(input.source ?? "").trim() || undefined,
    bookingStatus: String(input.bookingStatus ?? "").trim() || undefined,
    message: String(input.message ?? "").trim() || undefined,
  };
}

export async function listReservations(businessId: string) {
  return getBusinessRequests(businessId);
}

export async function getReservationById(
  businessId: string,
  reservationId: string,
) {
  return getBusinessRequestById(businessId, reservationId);
}

export async function createReservation(
  businessId: string,
  input: ReservationInput,
) {
  const reservationInput = normalizeReservationInput(input);
  return await createBusinessRequest(businessId, reservationInput);
}

export async function updateReservation(
  businessId: string,
  input: ReservationUpdateInput,
) {
  const recordId = String(input.recordId ?? "").trim();

  if (!recordId) {
    throw new Error("Rezervasyon bulunamadı.");
  }

  const updated = await updateBusinessRequestRecord(businessId, recordId, {
    assignedVehicle:
      input.assignedVehicle === undefined
        ? undefined
        : String(input.assignedVehicle).trim(),
    driverName:
      input.driverName === undefined
        ? undefined
        : String(input.driverName).trim(),
    bookingStatus:
      input.bookingStatus === undefined
        ? undefined
        : String(input.bookingStatus).trim(),
    vehicleName:
      input.vehicleName === undefined
        ? undefined
        : String(input.vehicleName).trim(),
    vehicleCategory:
      input.vehicleCategory === undefined
        ? undefined
        : String(input.vehicleCategory).trim(),
    paymentStatus:
      input.paymentStatus === undefined
        ? undefined
        : String(input.paymentStatus).trim(),
    notes: input.notes === undefined ? undefined : String(input.notes).trim(),
  });

  if (!updated) {
    throw new Error("Rezervasyon güncellenemedi.");
  }

  return updated;
}
