import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { deleteVehicle, updateVehicle } from "@/lib/operations";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
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
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const vehicle = await updateVehicle({
      businessId: auth.session.businessId,
      vehicleId: id,
      plate: normalizeText(body?.plate),
      brand: normalizeText(body?.brand),
      model: normalizeText(body?.model),
      capacity: normalizeNumber(body?.capacity),
      active: normalizeBoolean(body?.active),
    });

    return NextResponse.json({ ok: true, vehicle });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "update_failed",
        message: error instanceof Error ? error.message : "Vehicle güncellenemedi.",
      },
      { status: 500 },
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

  try {
    await deleteVehicle(auth.session.businessId, id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "delete_failed",
        message: error instanceof Error ? error.message : "Vehicle silinemedi.",
      },
      { status: 500 },
    );
  }
}

