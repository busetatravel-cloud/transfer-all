import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { createDriver, listDriversByBusiness } from "@/lib/operations";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const drivers = await listDriversByBusiness(auth.session.businessId);
  return NextResponse.json({ ok: true, drivers });
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const driver = await createDriver({
      businessId: auth.session.businessId,
      name: normalizeText(body?.name),
      phone: normalizeText(body?.phone),
      email: normalizeText(body?.email),
      active: normalizeBoolean(body?.active),
      notes: normalizeText(body?.notes),
    });

    return NextResponse.json({ ok: true, driver });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "create_failed",
        message: error instanceof Error ? error.message : "Driver oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}

