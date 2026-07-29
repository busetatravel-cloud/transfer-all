import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { assignReservation, createReservationAssignment, listAssignments } from "@/lib/operations";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const assignments = await listAssignments(auth.session.businessId);
  return NextResponse.json({ ok: true, assignments });
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    ensureNoBusinessIdSpoofing(body, auth.session.businessId);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message:
          error instanceof Error && error.message === "business_id_mismatch"
            ? "businessId session ile uyusmuyor."
            : "Gecersiz istek.",
      },
      { status: 400 },
    );
  }

  const reservationId = normalizeText(body?.reservationId);

  if (!reservationId) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Reservation ID gerekli.",
      },
      { status: 400 },
    );
  }

  try {
    const assignment = await assignReservation({
      businessId: auth.session.businessId,
      reservationId,
      driverId: normalizeText(body?.driverId) || null,
      vehicleId: normalizeText(body?.vehicleId) || null,
      assignedBy: auth.session.userId,
      pickupTime: normalizeText(body?.pickupTime) || null,
      meetingPoint: normalizeText(body?.meetingPoint) || null,
    });

    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "create_failed",
        message: error instanceof Error ? error.message : "Atama oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}
