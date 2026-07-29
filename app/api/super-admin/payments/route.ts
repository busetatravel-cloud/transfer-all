import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { listPayments } from "@/lib/payments";

export async function GET() {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payments = await listPayments();

  return NextResponse.json({
    ok: true,
    payments,
  });
}
