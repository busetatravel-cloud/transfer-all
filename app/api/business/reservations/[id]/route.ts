import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getReservationById, updateReservation } from "@/lib/reservation-service";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

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

async function supabaseDeleteReservation(businessId: string, reservationId: string) {
  const config = getSupabaseConfig();

  if (!config) {
    return true;
  }

  const response = await fetch(
    `${config.url}/rest/v1/requests?id=eq.${encodeURIComponent(reservationId)}&business_id=eq.${encodeURIComponent(
      businessId,
    )}`,
    {
      method: "DELETE",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Rezervasyon silinemedi.");
  }

  return true;
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
      supplierName: normalizeOptionalText(parseBodyField(body, "supplierName")),
      agencyName: normalizeOptionalText(parseBodyField(body, "agencyName")),
      collectedAmount: parseBodyField(body, "collectedAmount") as string | number | undefined,
      supplierPass: parseBodyField(body, "supplierPass") as string | number | undefined,
      agencyPass: parseBodyField(body, "agencyPass") as string | number | undefined,
      supplierCollection: parseBodyField(body, "supplierCollection") as string | number | undefined,
      profit: parseBodyField(body, "profit") as string | number | undefined,
      paymentStatus: normalizeOptionalText(parseBodyField(body, "paymentStatus")),
      notes: normalizeOptionalText(parseBodyField(body, "notes")),
      totalAmount: parseBodyField(body, "totalAmount") as string | number | undefined,
      depositAmount: parseBodyField(body, "depositAmount") as string | number | undefined,
      remainingAmount: parseBodyField(body, "remainingAmount") as string | number | undefined,
    });

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "reservation",
      entityId: id,
      action: "update",
      before: existing,
      after: reservation,
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await getReservationById(auth.session.businessId, id);

  if (!existing) {
    return buildErrorResponse(404, "not_found", "Rezervasyon bulunamadı.");
  }

  console.info("business.reservations.delete", {
    businessId: auth.session.businessId,
    reservationId: id,
  });

  try {
    if (hasSupabaseConnection()) {
      await supabaseDeleteReservation(auth.session.businessId, id);
    }

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "reservation",
      entityId: id,
      action: "delete",
      before: existing,
      after: null,
    });

    return NextResponse.json({
      ok: true,
      reservationId: id,
    });
  } catch (error) {
    console.error("business.reservations.delete.failed", error);
    return buildErrorResponse(
      500,
      "delete_failed",
      error instanceof Error ? error.message : "Rezervasyon silinemedi.",
      undefined,
      error,
    );
  }
}
