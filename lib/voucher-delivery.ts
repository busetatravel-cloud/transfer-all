import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type VoucherDeliveryChannel = "mail" | "whatsapp";
export type VoucherDeliveryStatus =
  | "draft"
  | "copied"
  | "sent_placeholder"
  | "sent"
  | "failed";

export type VoucherDeliveryLogRecord = {
  id: string;
  businessId: string;
  reservationId: string;
  voucherId: string;
  channel: VoucherDeliveryChannel;
  recipient: string;
  status: VoucherDeliveryStatus;
  messagePreview: string;
  createdAt: string;
};

type VoucherDeliveryLogInput = {
  businessId: string;
  reservationId: string;
  voucherId: string;
  channel: VoucherDeliveryChannel;
  recipient: string;
  status?: VoucherDeliveryStatus;
  messagePreview: string;
};

const demoLogs = new Map<string, VoucherDeliveryLogRecord[]>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
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

function mapLog(row: Record<string, unknown>): VoucherDeliveryLogRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    reservationId: String(row.reservation_id ?? ""),
    voucherId: String(row.voucher_id ?? ""),
    channel: String(row.channel ?? "mail") as VoucherDeliveryChannel,
    recipient: String(row.recipient ?? ""),
    status: String(row.status ?? "draft") as VoucherDeliveryStatus,
    messagePreview: String(row.message_preview ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

function insertDemoLog(input: VoucherDeliveryLogInput) {
  const record: VoucherDeliveryLogRecord = {
    id: `voucher-log-${randomUUID()}`,
    businessId: input.businessId,
    reservationId: input.reservationId,
    voucherId: input.voucherId,
    channel: input.channel,
    recipient: normalizeText(input.recipient),
    status: input.status ?? "draft",
    messagePreview: normalizeText(input.messagePreview),
    createdAt: nowIso(),
  };

  const current = demoLogs.get(input.businessId) ?? [];
  demoLogs.set(input.businessId, [record, ...current]);
  return record;
}

export async function createVoucherDeliveryLog(input: VoucherDeliveryLogInput) {
  const payload = {
    business_id: input.businessId,
    reservation_id: input.reservationId,
    voucher_id: input.voucherId,
    channel: input.channel,
    recipient: normalizeText(input.recipient),
    status: input.status ?? "draft",
    message_preview: normalizeText(input.messagePreview),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(`/business_voucher_delivery_logs`, {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    });

    if (!response?.ok) {
      throw new Error("Voucher teslimat logu kaydedilemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;

    if (rows[0]) {
      return mapLog(rows[0]);
    }
  }

  return insertDemoLog(input);
}

export async function listVoucherDeliveryLogs(businessId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_voucher_delivery_logs?select=id,business_id,reservation_id,voucher_id,channel,recipient,status,message_preview,created_at&business_id=eq.${encodeURIComponent(
        businessId,
      )}&order=created_at.desc`,
    );

    if (!response?.ok) {
      return [];
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows.map(mapLog);
  }

  return demoLogs.get(businessId)?.slice() ?? [];
}
