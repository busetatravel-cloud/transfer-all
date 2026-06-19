import "server-only";

import { randomUUID } from "node:crypto";
import { upsertBusinessCustomerFromReservation } from "@/lib/customers";
import { getBusinessById } from "@/lib/business";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import { createNotification } from "@/lib/notifications";
import {
  type ReservationCreateInput,
  type ReservationRecord,
  type ReservationUpdateInput,
} from "@/lib/reservation-types";
import type { BusinessRequestRecord } from "@/lib/requests";
import { syncBusinessVoucherFromReservation } from "@/lib/vouchers";

const DEMO_BUSINESS_ID = "business-demo-1";

const demoReservations = new Map<string, ReservationRecord[]>([
  [
    DEMO_BUSINESS_ID,
    [
      {
        id: "reservation-1",
        businessId: DEMO_BUSINESS_ID,
        customerName: "Demo Müşteri",
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
        notes: "Demo rezervasyon.",
        source: "manual",
        bookingStatus: "Bekliyor",
        message: "Demo rezervasyon.",
        status: "new",
        createdAt: "2026-06-10T10:00:00.000Z",
      },
    ],
  ],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function normalizeOptionalText(value?: string | null) {
  const safe = normalizeText(value);
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

function normalizeBookingStatus(value?: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "Bekliyor";
  }

  const map: Record<string, string> = {
    new: "Bekliyor",
    in_progress: "Şoför Atandı",
    completed: "Tamamlandı",
    archived: "İptal",
    bekliyor: "Bekliyor",
    onaylandi: "Onaylandı",
    onaylandı: "Onaylandı",
    sofor_atandi: "Şoför Atandı",
    şoför_atandı: "Şoför Atandı",
    tamamlandi: "Tamamlandı",
    tamamlandı: "Tamamlandı",
    iptal: "İptal",
  };

  return map[normalized.toLowerCase()] ?? normalized;
}

function normalizePaymentStatus(value?: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "Ödenmedi";
  }

  const map: Record<string, string> = {
    unpaid: "Ödenmedi",
    new: "Ödenmedi",
    odenmedi: "Ödenmedi",
    ödenmedi: "Ödenmedi",
    deposit: "Kapora Alındı",
    kapora_alindi: "Kapora Alındı",
    kapora_alındı: "Kapora Alındı",
    paid: "Ödendi",
    odendi: "Ödendi",
    ödendi: "Ödendi",
    cash: "Araçta Tahsil",
    aracta_tahsil: "Araçta Tahsil",
    araçta_tahsil: "Araçta Tahsil",
    refund: "İade",
    iade: "İade",
    canceled: "İptal",
    cancelled: "İptal",
    iptal: "İptal",
    archived: "İptal",
  };

  return map[normalized.toLowerCase()] ?? normalized;
}

function mapReservation(row: Record<string, unknown>): ReservationRecord {
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
    adultCount: Number(row.adult_count ?? 1),
    childCount: Number(row.child_count ?? 0),
    babyCount: Number(row.baby_count ?? 0),
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
    paymentStatus: normalizePaymentStatus(row.payment_status as string | null),
    notes: (row.notes as string | null) ?? null,
    source: (row.source as string | null) ?? "Manuel",
    bookingStatus: normalizeBookingStatus(row.booking_status as string | null),
    message: String(row.message ?? row.notes ?? ""),
    status: String(row.status ?? "new"),
    createdAt: String(row.created_at ?? ""),
  };
}

function sanitizeReservationCreatePayload(
  businessId: string,
  input: ReservationCreateInput,
) {
  const customerName = normalizeText(input.customerName);
  const fromLocation = normalizeText(input.fromLocation ?? input.origin);
  const toLocation = normalizeText(input.toLocation ?? input.destination);
  const travelDate = normalizeText(input.travelDate);
  const travelTime = normalizeText(input.travelTime);
  const vehicleName = normalizeOptionalText(input.vehicleName);
  const note = normalizeOptionalText(input.notes);

  const payload = {
    business_id: businessId,
    customer_name: customerName,
    phone: normalizeOptionalText(input.phone),
    email: normalizeOptionalText(input.email),
    country: normalizeOptionalText(input.country),
    language: normalizeOptionalText(input.language) ?? "tr",
    from_location: fromLocation || null,
    to_location: toLocation || null,
    travel_date: travelDate || null,
    travel_time: travelTime || null,
    flight_code: normalizeOptionalText(input.flightCode),
    adult_count: normalizeCount(input.adultCount ?? input.adults) || 1,
    child_count: normalizeCount(input.childCount ?? input.children),
    baby_count: normalizeCount(input.babyCount ?? input.infants),
    vehicle_category: normalizeOptionalText(input.vehicleCategory),
    vehicle_name: vehicleName,
    total_amount: normalizeAmount(input.totalAmount),
    deposit_amount: normalizeAmount(input.depositAmount),
    remaining_amount: normalizeAmount(input.remainingAmount),
    currency: normalizeOptionalText(input.currency) ?? "TRY",
    notes: note,
    payment_status: normalizePaymentStatus(input.paymentStatus),
    source: normalizeOptionalText(input.source) ?? "Manuel",
    booking_status: normalizeBookingStatus(input.bookingStatus),
    status: "new",
  };

  console.info("INSERT REQUEST PAYLOAD", payload);

  return payload;
}

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

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response?.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

async function readErrorMessage(response: Response | null, fallback: string) {
  if (!response) {
    return fallback;
  }

  const body = await response.json().catch(() => null);

  if (body && typeof body === "object") {
    const message = (body as { message?: string; error?: string }).message;
    const error = (body as { error?: string }).error;
    return message ?? error ?? fallback;
  }

  return fallback;
}

export async function listReservations(businessId: string) {
  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/requests?select=id,business_id,customer_name,phone,email,country,language,from_location,to_location,travel_date,travel_time,flight_code,adult_count,child_count,baby_count,vehicle_category,vehicle_name,assigned_vehicle,driver_name,pickup_status,operation_notes,total_amount,deposit_amount,remaining_amount,currency,payment_status,notes,source,booking_status,message,status,created_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&order=created_at.desc`,
    );

    return rows.map(mapReservation);
  }

  return demoReservations.get(businessId)?.slice() ?? [];
}

export async function getReservationById(
  businessId: string,
  reservationId: string,
) {
  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/requests?select=id,business_id,customer_name,phone,email,country,language,from_location,to_location,travel_date,travel_time,flight_code,adult_count,child_count,baby_count,vehicle_category,vehicle_name,assigned_vehicle,driver_name,pickup_status,operation_notes,total_amount,deposit_amount,remaining_amount,currency,payment_status,notes,source,booking_status,message,status,created_at&id=eq.${encodeURIComponent(
        reservationId,
      )}&business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
    );

    return rows[0] ? mapReservation(rows[0]) : null;
  }

  return (
    demoReservations.get(businessId)?.find((entry) => entry.id === reservationId) ?? null
  );
}

export async function createReservation(
  businessId: string,
  input: ReservationCreateInput,
) {
  const payload = sanitizeReservationCreatePayload(businessId, input);

  if (!payload.customer_name) {
    throw new Error("Müşteri adı soyadı gerekli.");
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/requests`, {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response?.ok) {
      throw new Error(await readErrorMessage(response, "Rezervasyon kaydedilemedi."));
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;

    if (!rows[0]) {
      throw new Error("Rezervasyon kaydı döndürülmedi.");
    }

    const created = mapReservation(rows[0]);
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
      await syncBusinessVoucherFromReservation(
        businessId,
        created as unknown as BusinessRequestRecord,
      );
    } catch (error) {
      console.warn("voucher.create.failed", {
        businessId,
        reservationId: created.id,
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

  const record: ReservationRecord = {
    id: `reservation-${randomUUID()}`,
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
    paymentStatus: payload.payment_status,
    notes: payload.notes,
    source: payload.source,
    bookingStatus: payload.booking_status,
    message: payload.notes ?? "",
    status: payload.status,
    createdAt: nowIso(),
  };

  const current = demoReservations.get(businessId) ?? [];
  demoReservations.set(businessId, [record, ...current]);

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
    await syncBusinessVoucherFromReservation(
      businessId,
      record as unknown as BusinessRequestRecord,
    );
  } catch (error) {
    console.warn("voucher.create.failed", {
      businessId,
      reservationId: record.id,
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

export async function updateReservation(
  businessId: string,
  input: ReservationUpdateInput,
) {
  const recordId = String(input.recordId ?? "").trim();

  if (!recordId) {
    throw new Error("Rezervasyon bulunamadı.");
  }

  const patchPayload: Record<string, unknown> = {};

  if (input.assignedVehicle !== undefined) {
    patchPayload.assigned_vehicle = normalizeOptionalText(input.assignedVehicle);
  }

  if (input.driverName !== undefined) {
    patchPayload.driver_name = normalizeOptionalText(input.driverName);
  }

  if (input.pickupStatus !== undefined) {
    patchPayload.pickup_status = normalizeOptionalText(input.pickupStatus);
  }

  if (input.operationNotes !== undefined) {
    patchPayload.operation_notes = normalizeOptionalText(input.operationNotes);
  }

  if (input.bookingStatus !== undefined) {
    patchPayload.booking_status = normalizeBookingStatus(input.bookingStatus);
  }

  if (input.vehicleName !== undefined) {
    patchPayload.vehicle_name = normalizeOptionalText(input.vehicleName);
  }

  if (input.vehicleCategory !== undefined) {
    patchPayload.vehicle_category = normalizeOptionalText(input.vehicleCategory);
  }

  if (input.paymentStatus !== undefined) {
    patchPayload.payment_status = normalizePaymentStatus(input.paymentStatus);
  }

  if (input.notes !== undefined) {
    patchPayload.notes = normalizeOptionalText(input.notes);
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/requests?id=eq.${encodeURIComponent(recordId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(patchPayload),
      },
    );

    if (!response?.ok) {
      throw new Error(await readErrorMessage(response, "Rezervasyon güncellenemedi."));
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;

    if (!rows[0]) {
      throw new Error("Rezervasyon güncellenemedi.");
    }

    const updated = mapReservation(rows[0]);

    try {
      await syncBusinessVoucherFromReservation(
        businessId,
        updated as unknown as BusinessRequestRecord,
      );
    } catch (error) {
      console.warn("voucher.update.failed", {
        businessId,
        reservationId: recordId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return updated;
  }

  const current = demoReservations.get(businessId) ?? [];
  const existing = current.find((entry) => entry.id === recordId) ?? null;

  if (!existing) {
    throw new Error("Rezervasyon bulunamadı.");
  }

  const updated: ReservationRecord = {
    ...existing,
    assignedVehicle:
      (patchPayload.assigned_vehicle as string | null | undefined) ?? existing.assignedVehicle,
    driverName: (patchPayload.driver_name as string | null | undefined) ?? existing.driverName,
    pickupStatus:
      (patchPayload.pickup_status as string | null | undefined) ?? existing.pickupStatus,
    operationNotes:
      (patchPayload.operation_notes as string | null | undefined) ?? existing.operationNotes,
    bookingStatus:
      (patchPayload.booking_status as string | undefined) ?? existing.bookingStatus,
    vehicleName:
      (patchPayload.vehicle_name as string | null | undefined) ?? existing.vehicleName,
    vehicleCategory:
      (patchPayload.vehicle_category as string | null | undefined) ?? existing.vehicleCategory,
    paymentStatus:
      (patchPayload.payment_status as string | undefined) ?? existing.paymentStatus,
    notes: (patchPayload.notes as string | null | undefined) ?? existing.notes,
  };

  demoReservations.set(
    businessId,
    current.map((entry) => (entry.id === recordId ? updated : entry)),
  );

  try {
    await syncBusinessVoucherFromReservation(
      businessId,
      updated as unknown as BusinessRequestRecord,
    );
  } catch (error) {
    console.warn("voucher.update.failed", {
      businessId,
      reservationId: recordId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return updated;
}

export async function requireReservationBusiness(businessId: string) {
  const business = await getBusinessById(businessId);

  if (!business) {
    throw new Error("Business bulunamadı.");
  }

  return business;
}
