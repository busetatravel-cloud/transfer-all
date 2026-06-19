import "server-only";

import { randomUUID } from "node:crypto";
import { listBusinessCustomers } from "@/lib/customers";
import { listTasks } from "@/lib/tasks";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import { listReservations } from "@/lib/reservation-service";

export type ExportType =
  | "reservations"
  | "customers"
  | "tasks"
  | "finance"
  | "operation";

export type ExportStatus = "draft" | "copied" | "failed";

export type ExportLogRecord = {
  id: string;
  businessId: string;
  exportType: ExportType;
  status: ExportStatus;
  rowCount: number;
  createdAt: string;
};

export type ExportPreview = {
  exportType: ExportType;
  csv: string;
  rowCount: number;
  headers: string[];
  rows: string[][];
};

const demoExportLogs = new Map<string, ExportLogRecord[]>([]);

function nowIso() {
  return new Date().toISOString();
}

function csvEscape(value: unknown) {
  const safe = String(value ?? "");

  if (/[",\n\r;]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }

  return safe;
}

function toCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function mapCustomerRow(customer: Awaited<ReturnType<typeof listBusinessCustomers>>[number]) {
  return [
    customer.fullName,
    customer.email ?? "",
    customer.phone ?? "",
    customer.country ?? "",
    customer.language ?? "",
    customer.source,
    customer.notes,
    customer.active ? "Aktif" : "Pasif",
  ];
}

function mapTaskRow(task: Awaited<ReturnType<typeof listTasks>>[number]) {
  return [
    task.title,
    task.description ?? "",
    task.reservationId ?? "",
    task.customerName ?? "",
    task.dueDate ?? "",
    task.dueTime ?? "",
    task.priority,
    task.status,
  ];
}

function mapReservationRow(reservation: Awaited<ReturnType<typeof listReservations>>[number]) {
  return [
    reservation.customerName,
    reservation.phone ?? "",
    reservation.email ?? "",
    reservation.country ?? "",
    reservation.language ?? "",
    reservation.origin ?? "",
    reservation.destination ?? "",
    reservation.travelDate ?? "",
    reservation.travelTime ?? "",
    reservation.flightCode ?? "",
    reservation.adultCount,
    reservation.childCount,
    reservation.babyCount,
    reservation.vehicleCategory ?? "",
    reservation.vehicleName ?? "",
    reservation.supplierName ?? "",
    reservation.agencyName ?? "",
    reservation.collectedAmount ?? "",
    reservation.supplierPass ?? "",
    reservation.agencyPass ?? "",
    reservation.supplierCollection ?? "",
    reservation.profit ?? "",
    reservation.totalAmount ?? "",
    reservation.depositAmount ?? "",
    reservation.remainingAmount ?? "",
    reservation.currency ?? "",
    reservation.notes ?? "",
    reservation.paymentStatus,
    reservation.bookingStatus,
  ];
}

function mapOperationRow(reservation: Awaited<ReturnType<typeof listReservations>>[number]) {
  return [
    reservation.customerName,
    [reservation.origin, reservation.destination].filter(Boolean).join(" → "),
    reservation.travelDate ?? "",
    reservation.travelTime ?? "",
    reservation.assignedVehicle ?? reservation.vehicleName ?? "",
    reservation.driverName ?? "",
    reservation.pickupStatus ?? "",
    reservation.operationNotes ?? "",
    reservation.bookingStatus,
  ];
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

function demoLogsForBusiness(businessId: string) {
  return demoExportLogs.get(businessId)?.slice() ?? [];
}

export async function listExportLogs(businessId: string) {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return [];
  }

  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/business_export_logs?select=id,business_id,export_type,status,row_count,created_at&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&order=created_at.desc`,
    );

    return rows.map((row) => ({
      id: String(row.id ?? ""),
      businessId: String(row.business_id ?? ""),
      exportType: String(row.export_type ?? "reservations") as ExportType,
      status: String(row.status ?? "draft") as ExportStatus,
      rowCount: Number(row.row_count ?? 0),
      createdAt: String(row.created_at ?? ""),
    }));
  }

  return demoLogsForBusiness(safeBusinessId);
}

export async function createExportLog(
  businessId: string,
  exportType: ExportType,
  rowCount: number,
  status: ExportStatus = "draft",
) {
  const safeBusinessId = businessId.trim();
  if (!safeBusinessId) {
    return null;
  }

  const record: ExportLogRecord = {
    id: `export-${randomUUID()}`,
    businessId: safeBusinessId,
    exportType,
    status,
    rowCount: Math.max(0, Math.trunc(Number(rowCount ?? 0))),
    createdAt: nowIso(),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch("/business_export_logs", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: record.businessId,
        export_type: record.exportType,
        status: record.status,
        row_count: record.rowCount,
        created_at: record.createdAt,
      }),
    });

    if (!response?.ok) {
      throw new Error("Export kaydı oluşturulamadı.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) {
      return record;
    }

    return {
      id: String(row.id ?? record.id),
      businessId: String(row.business_id ?? record.businessId),
      exportType: String(row.export_type ?? record.exportType) as ExportType,
      status: String(row.status ?? record.status) as ExportStatus,
      rowCount: Number(row.row_count ?? record.rowCount),
      createdAt: String(row.created_at ?? record.createdAt),
    } satisfies ExportLogRecord;
  }

  const current = demoExportLogs.get(safeBusinessId) ?? [];
  demoExportLogs.set(safeBusinessId, [record, ...current]);
  return record;
}

export async function markExportCopied(businessId: string, exportId: string) {
  const safeBusinessId = businessId.trim();
  const safeExportId = exportId.trim();

  if (!safeBusinessId || !safeExportId) {
    return false;
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/business_export_logs?id=eq.${encodeURIComponent(safeExportId)}&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: "copied" }),
      },
    );

    return Boolean(response?.ok);
  }

  const current = demoExportLogs.get(safeBusinessId) ?? [];
  demoExportLogs.set(
    safeBusinessId,
    current.map((item) => (item.id === safeExportId ? { ...item, status: "copied" } : item)),
  );
  return true;
}

export async function buildExportPreview(
  businessId: string,
  exportType: ExportType,
): Promise<ExportPreview> {
  const safeBusinessId = businessId.trim();
  const safeType = exportType;

  const [reservations, customers, tasks] = await Promise.all([
    listReservations(safeBusinessId),
    listBusinessCustomers(safeBusinessId),
    listTasks(safeBusinessId),
  ]);

  if (safeType === "reservations") {
    const headers = [
      "Müşteri adı",
      "Telefon",
      "Mail",
      "Ülke",
      "Dil",
      "Nereden",
      "Nereye",
      "Tarih",
      "Saat",
      "Uçuş kodu",
      "Yetişkin",
      "Çocuk",
      "Bebek",
      "Araç kategorisi",
      "Araç",
      "Tedarikçi",
      "Acente",
      "Alınan",
      "Tedarikçi PASS",
      "Acente PASS",
      "Tedarikçi tahsilatı",
      "Kâr",
      "Toplam",
      "Kapora",
      "Kalan",
      "Para birimi",
      "Not",
      "Ödeme durumu",
      "Durum",
    ];
    const rows = reservations.map(mapReservationRow);
    return {
      exportType: safeType,
      headers,
      rows: rows.map((row) => row.map((value) => String(value ?? ""))),
      rowCount: rows.length,
      csv: toCsv(headers, rows),
    };
  }

  if (safeType === "customers") {
    const headers = ["Müşteri adı", "Mail", "Telefon", "Ülke", "Dil", "Kaynak", "Not", "Aktif"];
    const rows = customers.map(mapCustomerRow);
    return {
      exportType: safeType,
      headers,
      rows: rows.map((row) => row.map((value) => String(value ?? ""))),
      rowCount: rows.length,
      csv: toCsv(headers, rows),
    };
  }

  if (safeType === "tasks") {
    const headers = [
      "Başlık",
      "Açıklama",
      "İlgili rezervasyon",
      "Müşteri",
      "Tarih",
      "Saat",
      "Öncelik",
      "Durum",
    ];
    const rows = tasks.map(mapTaskRow);
    return {
      exportType: safeType,
      headers,
      rows: rows.map((row) => row.map((value) => String(value ?? ""))),
      rowCount: rows.length,
      csv: toCsv(headers, rows),
    };
  }

  if (safeType === "finance") {
    const headers = [
      "Müşteri adı",
      "Telefon",
      "Mail",
      "Ülke",
      "Dil",
      "Nereden",
      "Nereye",
      "Tarih",
      "Saat",
      "Uçuş kodu",
      "Yetişkin",
      "Çocuk",
      "Bebek",
      "Araç kategorisi",
      "Araç",
      "Tedarikçi",
      "Acente",
      "Alınan",
      "Tedarikçi PASS",
      "Acente PASS",
      "Tedarikçi tahsilatı",
      "Kâr",
      "Toplam",
      "Kapora",
      "Kalan",
      "Para birimi",
      "Not",
      "Ödeme durumu",
      "Durum",
    ];
    const rows = reservations.map(mapReservationRow);

    return {
      exportType: safeType,
      headers,
      rows: rows.map((row) => row.map((value) => String(value ?? ""))),
      rowCount: rows.length,
      csv: toCsv(headers, rows),
    };
  }

  const operationRows = reservations.filter((item) =>
    ["Onaylandı", "Şoför Atandı"].includes(item.bookingStatus),
  );
  const headers = [
    "Müşteri",
    "Rota",
    "Tarih",
    "Saat",
    "Araç",
    "Şoför",
    "Pickup",
    "Operasyon notu",
    "Durum",
  ];
  const rows = operationRows.map(mapOperationRow);

  return {
    exportType: safeType,
    headers,
    rows: rows.map((row) => row.map((value) => String(value ?? ""))),
    rowCount: rows.length,
    csv: toCsv(headers, rows),
  };
}
