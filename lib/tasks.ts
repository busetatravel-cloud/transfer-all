import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import type {
  BusinessTaskCreateInput,
  BusinessTaskPriority,
  BusinessTaskRecord,
  BusinessTaskStatus,
  BusinessTaskUpdateInput,
} from "@/lib/task-types";
import { createNotification } from "@/lib/notifications";

const DEMO_BUSINESS_ID = "business-demo-1";

const demoTasks = new Map<string, BusinessTaskRecord[]>([
  [
    DEMO_BUSINESS_ID,
    [
      {
        id: "task-1",
        businessId: DEMO_BUSINESS_ID,
        title: "Örnek görev",
        description: "Demo amaçlı görev.",
        reservationId: null,
        customerName: "Demo Müşteri",
        dueDate: "2026-06-19",
        dueTime: "12:00",
        priority: "Normal",
        status: "Bekliyor",
        createdAt: "2026-06-19T09:00:00.000Z",
        updatedAt: "2026-06-19T09:00:00.000Z",
      },
    ],
  ],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value?: string | null) {
  const safe = normalizeText(value);
  return safe || null;
}

function normalizePriority(value?: string | null): BusinessTaskPriority {
  const normalized = normalizeText(value);
  const allowed: BusinessTaskPriority[] = ["Düşük", "Normal", "Yüksek", "Acil"];
  return allowed.includes(normalized as BusinessTaskPriority)
    ? (normalized as BusinessTaskPriority)
    : "Normal";
}

function normalizeStatus(value?: string | null): BusinessTaskStatus {
  const normalized = normalizeText(value);
  const allowed: BusinessTaskStatus[] = ["Bekliyor", "Devam Ediyor", "Tamamlandı", "İptal"];
  return allowed.includes(normalized as BusinessTaskStatus)
    ? (normalized as BusinessTaskStatus)
    : "Bekliyor";
}

function mapTask(row: Record<string, unknown>): BusinessTaskRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    reservationId: (row.reservation_id as string | null) ?? null,
    customerName: (row.customer_name as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    dueTime: (row.due_time as string | null) ?? null,
    priority: normalizePriority(row.priority as string | null),
    status: normalizeStatus(row.status as string | null),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
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

async function readRows(path: string) {
  const response = await supabaseFetch(path);
  if (!response?.ok) return [];
  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

async function writeRow(path: string, payload: Record<string, unknown>, method = "POST") {
  const response = await supabaseFetch(path, {
    method,
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  if (!response?.ok) {
    const text = response ? await response.text().catch(() => "") : "";
    throw new Error(text || "Görev kaydı işlemi başarısız.");
  }

  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

function demoTasksForBusiness(businessId: string) {
  return demoTasks.get(businessId)?.slice() ?? [];
}

export async function listTasks(businessId: string) {
  if (!hasSupabaseConnection()) {
    return demoTasksForBusiness(businessId);
  }

  const rows = await readRows(
    `/business_tasks?select=id,business_id,title,description,reservation_id,customer_name,due_date,due_time,priority,status,created_at,updated_at&business_id=eq.${encodeURIComponent(
      businessId,
    )}&order=due_date.asc.nullslast,due_time.asc.nullslast,created_at.desc`,
  );

  return rows.map(mapTask);
}

export async function createTask(businessId: string, input: BusinessTaskCreateInput) {
  const payload = {
    business_id: businessId,
    title: normalizeText(input.title),
    description: normalizeOptionalText(input.description),
    reservation_id: normalizeOptionalText(input.reservationId),
    customer_name: normalizeOptionalText(input.customerName),
    due_date: normalizeOptionalText(input.dueDate),
    due_time: normalizeOptionalText(input.dueTime),
    priority: normalizePriority(input.priority),
    status: normalizeStatus(input.status),
  };

  console.info("INSERT TASK PAYLOAD", payload);

  if (!payload.title) {
    throw new Error("Başlık gerekli.");
  }

  if (!hasSupabaseConnection()) {
    const now = nowIso();
    const nextTask: BusinessTaskRecord = {
      id: `task-${randomUUID()}`,
      businessId,
      title: payload.title,
      description: payload.description,
      reservationId: payload.reservation_id,
      customerName: payload.customer_name,
      dueDate: payload.due_date,
      dueTime: payload.due_time,
      priority: payload.priority,
      status: payload.status,
      createdAt: now,
      updatedAt: now,
    };

    const current = demoTasks.get(businessId) ?? [];
    demoTasks.set(businessId, [nextTask, ...current]);
    try {
      await createNotification(businessId, {
        type: "Yeni görev",
        title: `Yeni görev: ${nextTask.title}`,
        message: `${nextTask.title} adlı görev oluşturuldu.`,
        relatedType: "task",
        relatedId: nextTask.id,
      });
    } catch (error) {
      console.warn("notification.create.failed", {
        businessId,
        type: "Yeni görev",
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return nextTask;
  }

  const row = await writeRow("/business_tasks", {
    id: randomUUID(),
    ...payload,
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  const task = mapTask(row ?? {});

  try {
    await createNotification(businessId, {
      type: "Yeni görev",
      title: `Yeni görev: ${task.title}`,
      message: `${task.title} adlı görev oluşturuldu.`,
      relatedType: "task",
      relatedId: task.id,
    });
  } catch (error) {
    console.warn("notification.create.failed", {
      businessId,
      type: "Yeni görev",
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return task;
}

export async function updateTask(businessId: string, input: BusinessTaskUpdateInput) {
  const recordId = normalizeText(input.recordId);
  if (!recordId) {
    throw new Error("Görev kaydı bulunamadı.");
  }

  const current = await listTasks(businessId);
  const existing = current.find((item) => item.id === recordId);

  if (!existing) {
    throw new Error("Görev kaydı bulunamadı.");
  }

  const payload = {
    title: input.title === undefined ? existing.title : normalizeText(input.title),
    description:
      input.description === undefined ? existing.description : normalizeOptionalText(input.description),
    reservation_id:
      input.reservationId === undefined ? existing.reservationId : normalizeOptionalText(input.reservationId),
    customer_name:
      input.customerName === undefined ? existing.customerName : normalizeOptionalText(input.customerName),
    due_date: input.dueDate === undefined ? existing.dueDate : normalizeOptionalText(input.dueDate),
    due_time: input.dueTime === undefined ? existing.dueTime : normalizeOptionalText(input.dueTime),
    priority: input.priority === undefined ? existing.priority : normalizePriority(input.priority),
    status: input.status === undefined ? existing.status : normalizeStatus(input.status),
    updated_at: nowIso(),
  };

  if (!hasSupabaseConnection()) {
    const next: BusinessTaskRecord = {
      ...existing,
      ...payload,
      id: existing.id,
      businessId,
      priority: payload.priority,
      status: payload.status,
    };

    const nextList = current.map((item) => (item.id === recordId ? next : item));
    demoTasks.set(businessId, nextList);
    return next;
  }

  const row = await writeRow(
    `/business_tasks?id=eq.${encodeURIComponent(recordId)}&business_id=eq.${encodeURIComponent(businessId)}`,
    payload,
    "PATCH",
  );

  return mapTask(row ?? {});
}

export async function deleteTask(businessId: string, recordId: string) {
  const safeRecordId = normalizeText(recordId);

  if (!safeRecordId) {
    throw new Error("Görev kaydı bulunamadı.");
  }

  if (!hasSupabaseConnection()) {
    const current = demoTasks.get(businessId) ?? [];
    demoTasks.set(
      businessId,
      current.filter((item) => item.id !== safeRecordId),
    );
    return true;
  }

  const response = await supabaseFetch(
    `/business_tasks?id=eq.${encodeURIComponent(safeRecordId)}&business_id=eq.${encodeURIComponent(businessId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response?.ok) {
    const text = response ? await response.text().catch(() => "") : "";
    throw new Error(text || "Görev silinemedi.");
  }

  return true;
}

export async function listTasksByReservation(businessId: string, reservationId: string) {
  const tasks = await listTasks(businessId);
  return tasks.filter((task) => task.reservationId === reservationId);
}
