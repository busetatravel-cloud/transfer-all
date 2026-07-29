import "server-only";

import { randomUUID } from "node:crypto";
import { getPaymentProvider, normalizePaymentProvider } from "@/lib/payment-provider";
import { getReservationById } from "@/lib/reservation-service";
import {
  PAYMENT_STATUS_LABELS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  type PaymentRecord,
  type PaymentStatus,
  type PaymentUpsertInput,
  type PaymentUpdateInput,
} from "@/lib/payment-types";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

const demoPayments = new Map<string, PaymentRecord[]>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function normalizeCurrency(value?: string | null) {
  return normalizeText(value).toUpperCase() || "TRY";
}

function normalizeAmount(value?: number | string | null) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(",", "."));

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeProvider(value?: string | null) {
  const provider = normalizeText(value).toLowerCase();

  if (PAYMENT_PROVIDERS.includes(provider as (typeof PAYMENT_PROVIDERS)[number])) {
    return provider as (typeof PAYMENT_PROVIDERS)[number];
  }

  return "manual";
}

function normalizeStatus(value?: string | null) {
  const status = normalizeText(value);

  if (PAYMENT_STATUSES.includes(status as PaymentStatus)) {
    return status as PaymentStatus;
  }

  const map: Record<string, PaymentStatus> = {
    pending: "Pending",
    paid: "Paid",
    partial: "Partially Paid",
    "partially paid": "Partially Paid",
    failed: "Failed",
    refunded: "Refunded",
    cancelled: "Cancelled",
    canceled: "Cancelled",
  };

  return map[status.toLowerCase()] ?? "Pending";
}

function mapPayment(row: Record<string, unknown>): PaymentRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    reservationId: String(row.reservation_id ?? ""),
    provider: normalizeProvider(row.provider as string | null),
    amount: normalizeAmount(row.amount as number | string | null),
    currency: normalizeCurrency(row.currency as string | null),
    status: normalizeStatus(row.status as string | null),
    transactionReference:
      (row.transaction_reference as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapDemoPayment(input: PaymentUpsertInput, existing?: PaymentRecord | null) {
  const record: PaymentRecord = {
    id: existing?.id ?? `payment-${randomUUID()}`,
    businessId: input.businessId,
    reservationId: input.reservationId,
    provider: normalizeProvider(input.provider),
    amount: normalizeAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    status: normalizeStatus(input.status),
    transactionReference: input.transactionReference ?? existing?.transactionReference ?? null,
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };

  const current = demoPayments.get(input.businessId) ?? [];
  const next = current.filter((item) => item.reservationId !== input.reservationId);
  demoPayments.set(input.businessId, [record, ...next]);

  return record;
}

function mapDemoPaymentUpdate(input: PaymentUpdateInput, existing: PaymentRecord) {
  const updated: PaymentRecord = {
    ...existing,
    provider: normalizeProvider(input.provider ?? existing.provider),
    amount: input.amount !== undefined ? normalizeAmount(input.amount) : existing.amount,
    currency: input.currency ? normalizeCurrency(input.currency) : existing.currency,
    status: input.status ? normalizeStatus(input.status) : existing.status,
    transactionReference:
      input.transactionReference !== undefined
        ? input.transactionReference
        : existing.transactionReference,
    updatedAt: nowIso(),
  };

  const current = demoPayments.get(existing.businessId) ?? [];
  demoPayments.set(
    existing.businessId,
    current.map((item) => (item.id === existing.id ? updated : item)),
  );

  return updated;
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

export function formatPaymentStatusLabel(value?: string | null) {
  const status = normalizeStatus(value);
  return PAYMENT_STATUS_LABELS[status];
}

export async function listPayments(businessId?: string) {
  if (hasSupabaseConnection()) {
    const query = `/payments?select=id,business_id,reservation_id,provider,amount,currency,status,transaction_reference,created_at,updated_at${
      businessId ? `&business_id=eq.${encodeURIComponent(businessId)}` : ""
    }&order=created_at.desc`;
    const rows = await readRows(query);
    return rows.map(mapPayment);
  }

  if (businessId) {
    return demoPayments.get(businessId)?.slice() ?? [];
  }

  return Array.from(demoPayments.values()).flat();
}

export async function getPaymentById(paymentId: string, businessId?: string) {
  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/payments?select=id,business_id,reservation_id,provider,amount,currency,status,transaction_reference,created_at,updated_at&id=eq.${encodeURIComponent(
        paymentId,
      )}${businessId ? `&business_id=eq.${encodeURIComponent(businessId)}` : ""}&limit=1`,
    );

    return rows[0] ? mapPayment(rows[0]) : null;
  }

  if (businessId) {
    return demoPayments.get(businessId)?.find((item) => item.id === paymentId) ?? null;
  }

  for (const items of demoPayments.values()) {
    const found = items.find((item) => item.id === paymentId);
    if (found) {
      return found;
    }
  }

  return null;
}

export async function getPaymentByReservationId(
  businessId: string,
  reservationId: string,
) {
  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/payments?select=id,business_id,reservation_id,provider,amount,currency,status,transaction_reference,created_at,updated_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&reservation_id=eq.${encodeURIComponent(reservationId)}&limit=1`,
    );

    return rows[0] ? mapPayment(rows[0]) : null;
  }

  return (
    demoPayments.get(businessId)?.find((item) => item.reservationId === reservationId) ??
    null
  );
}

export async function upsertReservationPayment(input: PaymentUpsertInput) {
  const existing = await getPaymentByReservationId(input.businessId, input.reservationId);
  const nextStatus = normalizeStatus(input.status);
  const finalStatuses: PaymentStatus[] = ["Paid", "Partially Paid", "Refunded", "Cancelled"];

  if (existing && finalStatuses.includes(existing.status) && nextStatus === "Pending") {
    return existing;
  }

  if (hasSupabaseConnection()) {
    const payload = {
      business_id: input.businessId,
      reservation_id: input.reservationId,
      provider: normalizeProvider(input.provider),
      amount: normalizeAmount(input.amount),
      currency: normalizeCurrency(input.currency),
      status: nextStatus,
      transaction_reference: input.transactionReference ?? existing?.transactionReference ?? null,
    };

    if (existing) {
      const response = await supabaseFetch(
        `/payments?id=eq.${encodeURIComponent(existing.id)}&business_id=eq.${encodeURIComponent(
          input.businessId,
        )}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response?.ok) {
        throw new Error(await readErrorMessage(response, "Ödeme kaydı güncellenemedi."));
      }

      const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
      return rows[0] ? mapPayment(rows[0]) : existing;
    }

    const response = await supabaseFetch(`/payments`, {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response?.ok) {
      throw new Error(await readErrorMessage(response, "Ödeme kaydı oluşturulamadı."));
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapPayment(rows[0]) : null;
  }

  return mapDemoPayment(
    {
      ...input,
      status: nextStatus,
    },
    existing,
  );
}

export async function updatePaymentRecord(input: PaymentUpdateInput) {
  const existing = await getPaymentById(input.paymentId, input.businessId);

  if (!existing) {
    throw new Error("Ödeme bulunamadı.");
  }

  if (hasSupabaseConnection()) {
    const payload: Record<string, unknown> = {};

    if (input.provider !== undefined) {
      payload.provider = normalizeProvider(input.provider);
    }

    if (input.amount !== undefined) {
      payload.amount = normalizeAmount(input.amount);
    }

    if (input.currency !== undefined) {
      payload.currency = normalizeCurrency(input.currency);
    }

    if (input.status !== undefined) {
      payload.status = normalizeStatus(input.status);
    }

    if (input.transactionReference !== undefined) {
      payload.transaction_reference = input.transactionReference;
    }

    const response = await supabaseFetch(
      `/payments?id=eq.${encodeURIComponent(existing.id)}&business_id=eq.${encodeURIComponent(
        input.businessId,
      )}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response?.ok) {
      throw new Error(await readErrorMessage(response, "Ödeme kaydı güncellenemedi."));
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapPayment(rows[0]) : existing;
  }

  return mapDemoPaymentUpdate(input, existing);
}

export async function createReservationPaymentRecord(input: PaymentUpsertInput) {
  const reservation = await getReservationById(input.businessId, input.reservationId);

  if (!reservation) {
    throw new Error("Rezervasyon bulunamadi.");
  }

  const providerKey = normalizePaymentProvider(input.provider);
  const provider = getPaymentProvider(providerKey);
  const providerResult = await provider.createPayment({
    businessId: input.businessId,
    reservationId: input.reservationId,
    amount: input.amount,
    currency: input.currency,
    provider: providerKey,
    reservationTotalAmount: input.amount,
  });

  return upsertReservationPayment({
    ...input,
    provider: providerResult.provider,
    status: providerResult.status,
    transactionReference: providerResult.transactionReference,
  });
}

export async function completeReservationPaymentRecord(input: {
  businessId: string;
  paymentId: string;
  provider?: string | null;
  amount: number;
  currency: string;
  reservationId: string;
  reservationTotalAmount?: number | null;
  transactionReference?: string | null;
}) {
  const existingPayment = await getPaymentById(input.paymentId, input.businessId);
  const reservation = await getReservationById(input.businessId, input.reservationId);

  if (!existingPayment) {
    throw new Error("Odeme bulunamadi.");
  }

  if (!reservation) {
    throw new Error("Rezervasyon bulunamadi.");
  }

  const providerKey = normalizePaymentProvider(input.provider);
  const provider = getPaymentProvider(providerKey);
  const providerResult = await provider.completePayment({
    businessId: input.businessId,
    reservationId: input.reservationId,
    paymentId: input.paymentId,
    amount: input.amount,
    currency: input.currency,
    provider: providerKey,
    reservationTotalAmount: input.reservationTotalAmount ?? null,
    transactionReference: input.transactionReference ?? null,
  });

  return updatePaymentRecord({
    businessId: input.businessId,
    paymentId: input.paymentId,
    provider: providerResult.provider,
    amount: input.amount,
    currency: input.currency,
    status: providerResult.status,
    transactionReference: providerResult.transactionReference,
  });
}
