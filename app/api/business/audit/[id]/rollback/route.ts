import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { rollbackAuditLog } from "@/lib/audit";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const result = await rollbackAuditLog(auth.session.businessId, id);
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
