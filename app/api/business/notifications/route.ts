import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const notifications = await listNotifications(auth.session.businessId);
  return NextResponse.json({ ok: true, notifications });
}
