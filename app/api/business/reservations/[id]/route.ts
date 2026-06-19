import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getReservationById, updateReservation } from "@/lib/reservation-service";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const safe = normalizeText(value);
  return safe || undefined;
}

function parseBodyField(body: Record<string, unknown> | null, key: string) {
  if (!body) {
    return undefined;
  }

  const payload = body.payload as Record<string, unknown> | undefined;
  return payload?.[key] ?? body[key];
}

function buildErrorResponse(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
  error?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      fieldErrors,
      stack: error instanceof Error ? error.stack : undefined,
    },
    { status },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  console.info("business.reservations.patch", {
    businessId: auth.session.businessId,
    reservationId: id,
    bodyAction: body?.action,
    bodySection: body?.section,
    bodyPayload: body?.payload ?? body,
  });

  const existing = await getReservationById(auth.session.businessId, id);

  if (!existing) {
    return buildErrorResponse(404, "not_found", "Rezervasyon bulunamadı.");
  }

  try {
    const reservation = await updateReservation(auth.session.businessId, {
      recordId: id,
      assignedVehicle: normalizeOptionalText(parseBodyField(body, "assignedVehicle")),
      driverName: normalizeOptionalText(parseBodyField(body, "driverName")),
      pickupStatus: normalizeOptionalText(parseBodyField(body, "pickupStatus")),
      operationNotes: normalizeOptionalText(parseBodyField(body, "operationNotes")),
      bookingStatus: normalizeOptionalText(parseBodyField(body, "bookingStatus")),
      vehicleName: normalizeOptionalText(parseBodyField(body, "vehicleName")),
      vehicleCategory: normalizeOptionalText(parseBodyField(body, "vehicleCategory")),
      paymentStatus: normalizeOptionalText(parseBodyField(body, "paymentStatus")),
      notes: normalizeOptionalText(parseBodyField(body, "notes")),
    });

    return NextResponse.json({
      ok: true,
      reservation,
    });
  } catch (error) {
    console.error("business.reservations.patch.failed", error);
    return buildErrorResponse(
      500,
      "update_failed",
      error instanceof Error ? error.message : "Rezervasyon güncellenemedi.",
      undefined,
      error,
    );
  }
}
