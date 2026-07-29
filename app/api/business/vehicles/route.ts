import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { createVehicle, listVehiclesByBusiness } from "@/lib/operations";

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

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const vehicles = await listVehiclesByBusiness(auth.session.businessId);
  return NextResponse.json({ ok: true, vehicles });
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const vehicle = await createVehicle({
      businessId: auth.session.businessId,
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
        code: "create_failed",
        message: error instanceof Error ? error.message : "Vehicle oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}

