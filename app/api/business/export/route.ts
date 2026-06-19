import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import {
  buildExportPreview,
  createExportLog,
  listExportLogs,
  type ExportType,
} from "@/lib/export";

function normalizeType(value: string | null): ExportType {
  if (value === "customers" || value === "tasks" || value === "finance" || value === "operation") {
    return value;
  }

  return "reservations";
}

export async function GET(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const type = normalizeType(url.searchParams.get("type"));
  const preview = await buildExportPreview(auth.session.businessId, type);
  const log = await createExportLog(auth.session.businessId, type, preview.rowCount, "draft");
  const logs = await listExportLogs(auth.session.businessId);

  return NextResponse.json({
    ok: true,
    preview,
    log,
    logs,
  });
}
