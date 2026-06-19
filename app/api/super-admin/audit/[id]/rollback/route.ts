import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { getAuditLogById, rollbackAuditLog } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const log = await getAuditLogById(id);

    if (!log) {
      return NextResponse.json(
        { ok: false, message: "Audit kaydı bulunamadı." },
        { status: 404 },
      );
    }

    const result = await rollbackAuditLog(log.businessId, id);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Geri alma başarısız.",
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}
