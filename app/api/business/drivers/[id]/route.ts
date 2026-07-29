import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { deleteDriver, updateDriver } from "@/lib/operations";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
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
    const driver = await updateDriver({
      businessId: auth.session.businessId,
      driverId: id,
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
        code: "update_failed",
        message: error instanceof Error ? error.message : "Driver güncellenemedi.",
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
    await deleteDriver(auth.session.businessId, id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "delete_failed",
        message: error instanceof Error ? error.message : "Driver silinemedi.",
      },
      { status: 500 },
    );
  }
}

