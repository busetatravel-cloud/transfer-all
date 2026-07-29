import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { listPayments } from "@/lib/payments";

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const payments = await listPayments(auth.session.businessId);

  return NextResponse.json({
    ok: true,
    payments,
  });
}

