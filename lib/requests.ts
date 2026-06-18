import "server-only";

import { randomUUID } from "node:crypto";
import { upsertBusinessCustomerFromReservation } from "@/lib/customers";
import { formatPaymentStatusLabel } from "@/lib/request-statuses";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

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
  adults: number;
  children: number;
  infants: number;
  vehicleCategory: string | null;
  vehicleName: string | null;
  assignedVehicle: string | null;
  driverName: string | null;
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
  travelDate?: string;
  travelTime?: string;
  flightCode?: string;
  adults?: number | string;
  children?: number | string;
  infants?: number | string;
  vehicleCategory?: string;
  vehicleName?: string;
  assignedVehicle?: string;
  driverName?: string;
  totalAmount?: number | string;
  depositAmount?: number | string;
  remainingAmount?: number | string;
  currency?: string;
  paymentStatus?: string;
  notes?: string;
  source?: string;
  bookingStatus?: string;
  message?: string;
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
        adults: 2,
        children: 1,
        infants: 0,
        vehicleCategory: "VIP",
        vehicleName: "VIP Van",
        assignedVehicle: "VIP Van",
        driverName: "Demo Driver",
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
    origin: (row.origin as string | null) ?? null,
    destination: (row.destination as string | null) ?? null,
    travelDate: (row.travel_date as string | null) ?? null,
    travelTime: (row.travel_time as string | null) ?? null,
    flightCode: (row.flight_code as string | null) ?? null,
    adults: Number(row.adults ?? 0),
    children: Number(row.children ?? 0),
    infants: Number(row.infants ?? 0),
    vehicleCategory: (row.vehicle_category as string | null) ?? null,
    vehicleName: (row.vehicle_name as string | null) ?? null,
    assignedVehicle: (row.assigned_vehicle as string | null) ?? null,
    driverName: (row.driver_name as string | null) ?? null,
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
    source: (row.source as string | null) ?? "web",
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
  const source = normalizeText(input.source) ?? "web";
  const bookingStatus = formatBookingStatusLabel(input.bookingStatus);
  const customerName = input.customerName.trim();
  const notes = normalizeText(input.notes);
  const origin = normalizeText(input.origin);
  const destination = normalizeText(input.destination);
  const message =
    normalizeText(input.message) ??
    notes ??
    ([origin, destination].filter(Boolean).join(" - ") || "Rezervasyon kaydi");

  return {
    business_id: businessId,
    customer_name: customerName,
    phone: normalizeText(input.phone),
    email: normalizeEmail(input.email),
    country: normalizeText(input.country),
    language: normalizeText(input.language),
    origin,
    destination,
    travel_date: normalizeText(input.travelDate),
    travel_time: normalizeText(input.travelTime),
    flight_code: normalizeText(input.flightCode),
    adults: normalizeCount(input.adults),
    children: normalizeCount(input.children),
    infants: normalizeCount(input.infants),
    vehicle_category: normalizeText(input.vehicleCategory),
    vehicle_name: normalizeText(input.vehicleName),
    assigned_vehicle: normalizeText(input.assignedVehicle),
    driver_name: normalizeText(input.driverName),
    total_amount: normalizeAmount(input.totalAmount),
    deposit_amount: normalizeAmount(input.depositAmount),
    remaining_amount: normalizeAmount(input.remainingAmount),
    currency: normalizeText(input.currency) ?? "TRY",
    payment_status: normalizePaymentStatusValue(input.paymentStatus),
    notes,
    source,
    booking_status: bookingStatus,
    status: "new",
    message,
  };
}

export async function getBusinessRequests(businessId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/requests?select=id,business_id,customer_name,phone,email,country,language,origin,destination,travel_date,travel_time,flight_code,adults,children,infants,vehicle_category,vehicle_name,assigned_vehicle,driver_name,total_amount,deposit_amount,remaining_amount,currency,payment_status,notes,source,booking_status,message,status,created_at&business_id=eq.${encodeURIComponent(
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

export async function createBusinessRequest(
  businessId: string,
  input: BusinessRequestInput,
) {
  const payload = buildRequestPayload(businessId, input);

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/requests`, {
      method: "POST",
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
      return created;
    }

    const fallback = {
      id: randomUUID(),
      businessId,
      customerName: payload.customer_name,
      phone: payload.phone,
      email: payload.email,
      country: payload.country,
      language: payload.language,
      origin: payload.origin,
      destination: payload.destination,
      travelDate: payload.travel_date,
      travelTime: payload.travel_time,
      flightCode: payload.flight_code,
      adults: payload.adults,
      children: payload.children,
      infants: payload.infants,
      vehicleCategory: payload.vehicle_category,
      vehicleName: payload.vehicle_name,
      assignedVehicle: payload.assigned_vehicle,
      driverName: payload.driver_name,
      totalAmount: payload.total_amount,
      depositAmount: payload.deposit_amount,
      remainingAmount: payload.remaining_amount,
      currency: payload.currency,
      paymentStatus: payload.payment_status as BusinessRequestRecord["paymentStatus"],
      notes: payload.notes,
      source: payload.source,
      bookingStatus: payload.booking_status as BookingStatus,
      message: payload.message,
      status: "new",
      createdAt: nowIso(),
    } satisfies BusinessRequestRecord;

    await upsertBusinessCustomerFromReservation(businessId, {
      fullName: fallback.customerName,
      email: fallback.email ?? undefined,
      phone: fallback.phone ?? undefined,
      country: fallback.country ?? undefined,
      language: fallback.language ?? undefined,
      source: fallback.source,
      notes: fallback.notes ?? fallback.message ?? undefined,
    });

    return fallback;
  }

  const record: BusinessRequestRecord = {
    id: `request-${randomUUID()}`,
    businessId,
    customerName: payload.customer_name,
    phone: payload.phone,
    email: payload.email,
    country: payload.country,
    language: payload.language,
    origin: payload.origin,
    destination: payload.destination,
    travelDate: payload.travel_date,
    travelTime: payload.travel_time,
    flightCode: payload.flight_code,
    adults: payload.adults,
    children: payload.children,
    infants: payload.infants,
    vehicleCategory: payload.vehicle_category,
    vehicleName: payload.vehicle_name,
    assignedVehicle: payload.assigned_vehicle,
    driverName: payload.driver_name,
    totalAmount: payload.total_amount,
    depositAmount: payload.deposit_amount,
    remainingAmount: payload.remaining_amount,
    currency: payload.currency,
    paymentStatus: payload.payment_status as BusinessRequestRecord["paymentStatus"],
    notes: payload.notes,
    source: payload.source,
    bookingStatus: payload.booking_status as BookingStatus,
    message: payload.message,
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
  return record;
}

export async function updateBusinessRequestRecord(
  businessId: string,
  requestId: string,
  input: Partial<BusinessRequestInput> & {
    assignedVehicle?: string;
    driverName?: string;
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
        body: JSON.stringify(nextPayload),
      },
    );

    if (!response?.ok) {
      throw new Error("Rezervasyon guncellenemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    if (rows[0]) {
      return mapRequest(rows[0]);
    }

    return null;
  }

  if (!existing) {
    throw new Error("Rezervasyon bulunamadi.");
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
  };

  const current = demoRequests.get(businessId) ?? [];
  demoRequests.set(
    businessId,
    current.map((entry) => (entry.id === requestId ? next : entry)),
  );
  return next;
}
