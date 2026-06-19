import "server-only";

import { randomUUID } from "node:crypto";
import { deleteTask, updateTask } from "@/lib/tasks";
import {
  deleteReservation,
  updateReservation,
} from "@/lib/requests";
import { rollbackBusinessPublication } from "@/lib/publishing";
import {
  getSupabaseConfig,
  hasSupabaseConnection,
} from "@/lib/supabase-config";
import { updateBusinessDomainRecord, type BusinessRecord } from "@/lib/business";
import type { BusinessTaskPriority, BusinessTaskStatus } from "@/lib/task-types";

export type AuditAction = string;

export type AuditLogRecord = {
  id: string;
  businessId: string;
  actorUserId: string | null;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type AuditLogInput = {
  businessId: string;
  actorUserId?: string | null;
  actorRole: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  before?: unknown;
  after?: unknown;
};

const demoAuditLogs = new Map<string, AuditLogRecord[]>();

function nowIso() {
  return new Date().toISOString();
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

function mapAuditLog(row: Record<string, unknown>): AuditLogRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorRole: String(row.actor_role ?? ""),
    entityType: String(row.entity_type ?? ""),
    entityId: String(row.entity_id ?? ""),
    action: String(row.action ?? ""),
    before: row.before ?? null,
    after: row.after ?? null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function recordAuditLog(input: AuditLogInput) {
  const businessId = String(input.businessId ?? "").trim();

  if (!businessId) {
    return null;
  }

  const record: AuditLogRecord = {
    id: `audit-${randomUUID()}`,
    businessId,
    actorUserId: input.actorUserId ?? null,
    actorRole: String(input.actorRole ?? "BUSINESS_ADMIN"),
    entityType: String(input.entityType ?? ""),
    entityId: String(input.entityId ?? ""),
    action: String(input.action ?? ""),
    before: input.before ?? null,
    after: input.after ?? null,
    createdAt: nowIso(),
  };

  try {
    if (hasSupabaseConnection()) {
      const response = await supabaseFetch("/audit_logs", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          business_id: record.businessId,
          actor_user_id: record.actorUserId,
          actor_role: record.actorRole,
          entity_type: record.entityType,
          entity_id: record.entityId,
          action: record.action,
          before: record.before,
          after: record.after,
          created_at: record.createdAt,
        }),
      });

      if (!response?.ok) {
        const text = response ? await response.text().catch(() => "") : "";
        throw new Error(text || "Audit kaydı oluşturulamadı.");
      }

      const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
      return rows[0] ? mapAuditLog(rows[0]) : record;
    }

    const current = demoAuditLogs.get(businessId) ?? [];
    demoAuditLogs.set(businessId, [record, ...current]);
    return record;
  } catch (error) {
    console.warn("audit.record.failed", {
      businessId,
      entityType: record.entityType,
      entityId: record.entityId,
      action: record.action,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function listAuditLogs(
  businessId?: string | null,
  limit = 100,
) {
  const safeBusinessId = String(businessId ?? "").trim();

  if (hasSupabaseConnection()) {
    const query = safeBusinessId
      ? `/audit_logs?select=id,business_id,actor_user_id,actor_role,entity_type,entity_id,action,before,after,created_at&business_id=eq.${encodeURIComponent(
          safeBusinessId,
        )}&order=created_at.desc&limit=${Math.max(1, Math.trunc(limit))}`
      : `/audit_logs?select=id,business_id,actor_user_id,actor_role,entity_type,entity_id,action,before,after,created_at&order=created_at.desc&limit=${Math.max(
          1,
          Math.trunc(limit),
        )}`;

    const response = await supabaseFetch(query);

    if (!response?.ok) {
      return [];
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows.map(mapAuditLog);
  }

  if (!safeBusinessId) {
    return Array.from(demoAuditLogs.values()).flat().slice(0, limit);
  }

  return (demoAuditLogs.get(safeBusinessId) ?? []).slice(0, limit);
}

async function loadAuditLog(businessId: string, logId: string) {
  const logs = await listAuditLogs(businessId, 500);
  return logs.find((log) => log.id === logId) ?? null;
}

export async function rollbackAuditLog(
  businessId: string,
  logId: string,
) {
  const log = await loadAuditLog(businessId, logId);

  if (!log) {
    throw new Error("Audit kaydı bulunamadı.");
  }

  const before = log.before as Record<string, unknown> | null;
  const after = log.after as Record<string, unknown> | null;

  if (log.entityType === "reservation") {
    if (log.action === "create" && after) {
      await deleteReservation(businessId, log.entityId);
      return { rolledBack: true, entityType: "reservation" };
    }

    if (log.action === "update" && before) {
      await updateReservation(businessId, {
        recordId: log.entityId,
        customerName: String(before.customerName ?? ""),
        phone: before.phone as string | undefined,
        email: before.email as string | undefined,
        country: before.country as string | undefined,
        language: before.language as string | undefined,
        origin: before.origin as string | undefined,
        destination: before.destination as string | undefined,
        travelDate: before.travelDate as string | undefined,
        travelTime: before.travelTime as string | undefined,
        flightCode: before.flightCode as string | undefined,
        adultCount: before.adultCount as number | string | undefined,
        childCount: before.childCount as number | string | undefined,
        babyCount: before.babyCount as number | string | undefined,
        vehicleCategory: before.vehicleCategory as string | undefined,
        vehicleName: before.vehicleName as string | undefined,
        supplierName: before.supplierName as string | undefined,
        agencyName: before.agencyName as string | undefined,
        collectedAmount: before.collectedAmount as number | string | undefined,
        supplierPass: before.supplierPass as number | string | undefined,
        agencyPass: before.agencyPass as number | string | undefined,
        supplierCollection: before.supplierCollection as number | string | undefined,
        profit: before.profit as number | string | undefined,
        totalAmount: before.totalAmount as number | string | undefined,
        depositAmount: before.depositAmount as number | string | undefined,
        remainingAmount: before.remainingAmount as number | string | undefined,
        currency: before.currency as string | undefined,
        paymentStatus: before.paymentStatus as string | undefined,
        notes: before.notes as string | undefined,
        source: before.source as string | undefined,
        bookingStatus: before.bookingStatus as string | undefined,
        message: before.message as string | undefined,
        assignedVehicle: before.assignedVehicle as string | undefined,
        driverName: before.driverName as string | undefined,
        pickupStatus: before.pickupStatus as string | undefined,
        operationNotes: before.operationNotes as string | undefined,
      });
      return { rolledBack: true, entityType: "reservation" };
    }
  }

  if (log.entityType === "task") {
    if (log.action === "create") {
      await deleteTask(businessId, log.entityId);
      return { rolledBack: true, entityType: "task" };
    }

    if (log.action === "update" && before) {
      await updateTask(businessId, {
        recordId: log.entityId,
        title: String(before.title ?? ""),
        description: before.description as string | undefined,
        reservationId: before.reservationId as string | undefined,
        customerName: before.customerName as string | undefined,
        dueDate: before.dueDate as string | undefined,
        dueTime: before.dueTime as string | undefined,
        priority: before.priority as BusinessTaskPriority | undefined,
        status: before.status as BusinessTaskStatus | undefined,
      });
      return { rolledBack: true, entityType: "task" };
    }
  }

  if (log.entityType === "publication") {
    const result = await rollbackBusinessPublication(businessId);
    return { rolledBack: true, entityType: "publication", result };
  }

  if (log.entityType === "domain" && before) {
    await updateBusinessDomainRecord(businessId, {
      domain: before.domain as string | undefined,
      hostname: before.hostname as string | undefined,
      domainStatus: before.domainStatus as BusinessRecord["domainStatus"] | undefined,
      verificationToken: before.verificationToken as string | null | undefined,
      verifiedAt: before.verifiedAt as string | null | undefined,
      activatedAt: before.activatedAt as string | null | undefined,
      lastCheckedAt: before.lastCheckedAt as string | null | undefined,
      sslStatus: before.sslStatus as BusinessRecord["sslStatus"] | null | undefined,
    });
    return { rolledBack: true, entityType: "domain" };
  }

  throw new Error("Bu audit kaydı için geri alma desteklenmiyor.");
}

export async function getAuditLogById(logId: string) {
  const safeLogId = String(logId ?? "").trim();

  if (!safeLogId) {
    return null;
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/audit_logs?select=id,business_id,actor_user_id,actor_role,entity_type,entity_id,action,before,after,created_at&id=eq.${encodeURIComponent(
        safeLogId,
      )}&limit=1`,
    );

    if (!response?.ok) {
      return null;
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapAuditLog(rows[0]) : null;
  }

  for (const entries of demoAuditLogs.values()) {
    const match = entries.find((item) => item.id === safeLogId);
    if (match) {
      return match;
    }
  }

  return null;
}
