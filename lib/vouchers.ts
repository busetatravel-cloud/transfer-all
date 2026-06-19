import "server-only";

import { randomUUID } from "node:crypto";
import { getBusinessById, type BusinessRecord } from "@/lib/business";
import {
  getBusinessRequestById,
  type BusinessRequestRecord,
} from "@/lib/requests";
import { createNotification } from "@/lib/notifications";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessVoucherRecord = {
  id: string;
  businessId: string;
  requestId: string;
  documentNo: string;
  businessName: string;
  businessLogoUrl: string | null;
  language: string;
  bookingStatus: string;
  origin: string | null;
  destination: string | null;
  transferType: string | null;
  flightCode: string | null;
  vehicleName: string | null;
  travelDate: string | null;
  travelTime: string | null;
  customerName: string;
  phone: string | null;
  email: string | null;
  passengerCount: number;
  totalAmount: number | null;
  depositAmount: number | null;
  remainingAmount: number | null;
  currency: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type VoucherSeed = Omit<BusinessVoucherRecord, "id" | "createdAt" | "updatedAt">;

const demoVouchers = new Map<string, BusinessVoucherRecord[]>([
  [
    "business-demo-1",
    [
      {
        id: "voucher-1",
        businessId: "business-demo-1",
        requestId: "request-1",
        documentNo: "VCH-REQUEST-1",
        businessName: "Buse Transfer",
        businessLogoUrl: null,
        language: "tr",
        bookingStatus: "Bekliyor",
        origin: "Airport",
        destination: "Hotel",
        transferType: "VIP",
        flightCode: "TK123",
        vehicleName: "VIP Van",
        travelDate: "2026-06-10",
        travelTime: "10:30",
        customerName: "Demo User",
        phone: "+90 555 111 22 33",
        email: "demo@example.com",
        passengerCount: 3,
        totalAmount: 1200,
        depositAmount: 300,
        remainingAmount: 900,
        currency: "TRY",
        notes: "Airport transfer icin teklif istiyorum.",
        createdAt: "2026-06-10T10:00:00.000Z",
        updatedAt: "2026-06-10T10:00:00.000Z",
      },
    ],
  ],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || null;
}

function normalizeLanguage(value?: string | null) {
  return normalizeText(value)?.toLowerCase() ?? "tr";
}

function buildDocumentNo(requestId: string) {
  return `VCH-${requestId.replace(/-/g, "").slice(0, 10).toUpperCase()}`;
}

function getPassengerCount(record: {
  adultCount?: number;
  childCount?: number;
  babyCount?: number;
  adults?: number;
  children?: number;
  infants?: number;
}) {
  return (
    Number(record.adultCount ?? record.adults ?? 0) +
    Number(record.childCount ?? record.children ?? 0) +
    Number(record.babyCount ?? record.infants ?? 0)
  );
}

function mapVoucher(row: Record<string, unknown>): BusinessVoucherRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    requestId: String(row.request_id ?? ""),
    documentNo: String(row.document_no ?? ""),
    businessName: String(row.business_name ?? ""),
    businessLogoUrl: (row.business_logo_url as string | null) ?? null,
    language: normalizeLanguage(row.language as string | null),
    bookingStatus: String(row.booking_status ?? "Bekliyor"),
    origin: (row.origin as string | null) ?? null,
    destination: (row.destination as string | null) ?? null,
    transferType: (row.transfer_type as string | null) ?? null,
    flightCode: (row.flight_code as string | null) ?? null,
    vehicleName: (row.vehicle_name as string | null) ?? null,
    travelDate: (row.travel_date as string | null) ?? null,
    travelTime: (row.travel_time as string | null) ?? null,
    customerName: String(row.customer_name ?? ""),
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    passengerCount: Number(row.passenger_count ?? 0),
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
    currency: String(row.currency ?? "TRY"),
    notes: String(row.notes ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function buildVoucherSeed(
  business: BusinessRecord,
  request: BusinessRequestRecord,
  existing?: BusinessVoucherRecord | null,
): VoucherSeed {
  const language = normalizeLanguage(request.language);
  const passengerCount = getPassengerCount(request);

  return {
    businessId: business.id,
    requestId: request.id,
    documentNo: existing?.documentNo ?? buildDocumentNo(request.id),
    businessName: business.name,
    businessLogoUrl: business.logoUrl ?? null,
    language,
    bookingStatus: request.bookingStatus,
    origin: normalizeText(request.origin),
    destination: normalizeText(request.destination),
    transferType: normalizeText(request.vehicleCategory),
    flightCode: normalizeText(request.flightCode),
    vehicleName: normalizeText(request.vehicleName),
    travelDate: normalizeText(request.travelDate),
    travelTime: normalizeText(request.travelTime),
    customerName: request.customerName,
    phone: normalizeText(request.phone),
    email: normalizeText(request.email),
    passengerCount,
    totalAmount: request.totalAmount,
    depositAmount: request.depositAmount,
    remainingAmount: request.remainingAmount,
    currency: request.currency ?? "TRY",
    notes: normalizeText(request.notes) ?? normalizeText(request.message) ?? "",
  };
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

async function readVoucherRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response?.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

export async function getBusinessVoucherByRequestId(
  businessId: string,
  requestId: string,
) {
  if (hasSupabaseConnection()) {
    const rows = await readVoucherRows(
      `/business_vouchers?select=id,business_id,request_id,document_no,business_name,business_logo_url,language,booking_status,origin,destination,transfer_type,flight_code,vehicle_name,travel_date,travel_time,customer_name,phone,email,passenger_count,total_amount,deposit_amount,remaining_amount,currency,notes,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&request_id=eq.${encodeURIComponent(requestId)}&limit=1`,
    );

    return rows[0] ? mapVoucher(rows[0]) : null;
  }

  return (
    demoVouchers.get(businessId)?.find((entry) => entry.requestId === requestId) ??
    null
  );
}

export async function syncBusinessVoucherFromRequest(
  businessId: string,
  request: BusinessRequestRecord,
) {
  const business = await getBusinessById(businessId);

  if (!business) {
    throw new Error("Business bulunamadi.");
  }

  const existing = await getBusinessVoucherByRequestId(businessId, request.id);
  const isNewVoucher = !existing;
  const payload = buildVoucherSeed(business, request, existing);

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      existing
        ? `/business_vouchers?id=eq.${encodeURIComponent(existing.id)}&business_id=eq.${encodeURIComponent(
            businessId,
          )}`
        : `/business_vouchers`,
      {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({
          business_id: businessId,
          request_id: request.id,
          document_no: payload.documentNo,
          business_name: payload.businessName,
          business_logo_url: payload.businessLogoUrl,
          language: payload.language,
          booking_status: payload.bookingStatus,
          origin: payload.origin,
          destination: payload.destination,
          transfer_type: payload.transferType,
          flight_code: payload.flightCode,
          vehicle_name: payload.vehicleName,
          travel_date: payload.travelDate,
          travel_time: payload.travelTime,
          customer_name: payload.customerName,
          phone: payload.phone,
          email: payload.email,
          passenger_count: payload.passengerCount,
          total_amount: payload.totalAmount,
          deposit_amount: payload.depositAmount,
          remaining_amount: payload.remainingAmount,
          currency: payload.currency,
          notes: payload.notes,
          updated_at: nowIso(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Voucher kaydedilemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<
      Record<string, unknown>
    >;

    if (rows[0]) {
      const voucher = mapVoucher(rows[0]);
      if (isNewVoucher) {
        try {
          await createNotification(businessId, {
            type: "Voucher hazır",
            title: `Voucher hazır: ${voucher.documentNo}`,
            message: `${voucher.customerName} için voucher hazırlandı.`,
            relatedType: "voucher",
            relatedId: voucher.id,
          });
        } catch (error) {
          console.warn("notification.create.failed", {
            businessId,
            type: "Voucher hazır",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return voucher;
    }

    const voucher = {
      id: existing?.id ?? randomUUID(),
      businessId,
      requestId: request.id,
      documentNo: payload.documentNo,
      businessName: payload.businessName,
      businessLogoUrl: payload.businessLogoUrl,
      language: payload.language,
      bookingStatus: payload.bookingStatus,
      origin: payload.origin,
      destination: payload.destination,
      transferType: payload.transferType,
      flightCode: payload.flightCode,
      vehicleName: payload.vehicleName,
      travelDate: payload.travelDate,
      travelTime: payload.travelTime,
      customerName: payload.customerName,
      phone: payload.phone,
      email: payload.email,
      passengerCount: payload.passengerCount,
      totalAmount: payload.totalAmount,
      depositAmount: payload.depositAmount,
      remainingAmount: payload.remainingAmount,
      currency: payload.currency,
      notes: payload.notes,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    } satisfies BusinessVoucherRecord;

    if (isNewVoucher) {
      try {
        await createNotification(businessId, {
          type: "Voucher hazır",
          title: `Voucher hazır: ${voucher.documentNo}`,
          message: `${voucher.customerName} için voucher hazırlandı.`,
          relatedType: "voucher",
          relatedId: voucher.id,
        });
      } catch (error) {
        console.warn("notification.create.failed", {
          businessId,
          type: "Voucher hazır",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return voucher;
  }

  const record: BusinessVoucherRecord = {
    id: existing?.id ?? `voucher-${randomUUID()}`,
    businessId,
    requestId: request.id,
    documentNo: payload.documentNo,
    businessName: payload.businessName,
    businessLogoUrl: payload.businessLogoUrl,
    language: payload.language,
    bookingStatus: payload.bookingStatus,
    origin: payload.origin,
    destination: payload.destination,
    transferType: payload.transferType,
    flightCode: payload.flightCode,
    vehicleName: payload.vehicleName,
    travelDate: payload.travelDate,
    travelTime: payload.travelTime,
    customerName: payload.customerName,
    phone: payload.phone,
    email: payload.email,
    passengerCount: payload.passengerCount,
    totalAmount: payload.totalAmount,
    depositAmount: payload.depositAmount,
    remainingAmount: payload.remainingAmount,
    currency: payload.currency,
    notes: payload.notes,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  const current = demoVouchers.get(businessId) ?? [];
  demoVouchers.set(
    businessId,
    current.some((entry) => entry.requestId === request.id)
      ? current.map((entry) => (entry.requestId === request.id ? record : entry))
      : [record, ...current],
  );

  if (isNewVoucher) {
    try {
      await createNotification(businessId, {
        type: "Voucher hazır",
        title: `Voucher hazır: ${record.documentNo}`,
        message: `${record.customerName} için voucher hazırlandı.`,
        relatedType: "voucher",
        relatedId: record.id,
      });
    } catch (error) {
      console.warn("notification.create.failed", {
        businessId,
        type: "Voucher hazır",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return record;
}

export async function ensureBusinessVoucherForRequest(
  businessId: string,
  requestId: string,
) {
  const existing = await getBusinessVoucherByRequestId(businessId, requestId);

  if (existing) {
    return existing;
  }

  const request = await getBusinessRequestById(businessId, requestId);

  if (!request) {
    return null;
  }

  return syncBusinessVoucherFromRequest(businessId, request);
}

function buildFallbackVoucher(
  business: BusinessRecord,
  request: BusinessRequestRecord,
): BusinessVoucherRecord {
  return {
    id: `voucher-${request.id}`,
    businessId: business.id,
    requestId: request.id,
    documentNo: buildDocumentNo(request.id),
    businessName: business.name,
    businessLogoUrl: business.logoUrl ?? null,
    language: normalizeLanguage(request.language),
    bookingStatus: request.bookingStatus,
    origin: normalizeText(request.origin),
    destination: normalizeText(request.destination),
    transferType: normalizeText(request.vehicleCategory),
    flightCode: normalizeText(request.flightCode),
    vehicleName: normalizeText(request.vehicleName),
    travelDate: normalizeText(request.travelDate),
    travelTime: normalizeText(request.travelTime),
    customerName: request.customerName,
    phone: normalizeText(request.phone),
    email: normalizeText(request.email),
    passengerCount: getPassengerCount(request),
    totalAmount: request.totalAmount,
    depositAmount: request.depositAmount,
    remainingAmount: request.remainingAmount,
    currency: request.currency ?? "TRY",
    notes: normalizeText(request.notes) ?? normalizeText(request.message) ?? "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export async function getBusinessVoucherByReservationId(
  businessId: string,
  reservationId: string,
) {
  return getBusinessVoucherByRequestId(businessId, reservationId);
}

export async function syncBusinessVoucherFromReservation(
  businessId: string,
  reservation: BusinessRequestRecord,
) {
  return syncBusinessVoucherFromRequest(businessId, reservation);
}

export async function ensureBusinessVoucherForReservation(
  businessId: string,
  reservationId: string,
) {
  const business = await getBusinessById(businessId);

  if (!business) {
    return null;
  }

  const existing = await getBusinessVoucherByReservationId(businessId, reservationId);

  if (existing) {
    return existing;
  }

  const reservation = await getBusinessRequestById(businessId, reservationId);

  if (!reservation) {
    return null;
  }

  try {
    return await syncBusinessVoucherFromReservation(businessId, reservation);
  } catch (error) {
    console.warn("voucher.create.failed", {
      businessId,
      reservationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return buildFallbackVoucher(business, reservation);
  }
}
