import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { updateOperationStatus } from "@/lib/operations";
import { OPERATION_BOARD_STATUSES } from "@/lib/operation-types";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { reservationId } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const operationStatus = normalizeText(body?.operationStatus ?? body?.operation_status);

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

  if (!OPERATION_BOARD_STATUSES.includes(operationStatus as (typeof OPERATION_BOARD_STATUSES)[number])) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Geçerli bir operasyon durumu seçin.",
      },
      { status: 400 },
    );
  }

  try {
    const reservation = await updateOperationStatus(
      auth.session.businessId,
      reservationId,
      operationStatus as (typeof OPERATION_BOARD_STATUSES)[number],
    );

    return NextResponse.json({
      ok: true,
      reservation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "update_failed",
        message: error instanceof Error ? error.message : "Operasyon durumu güncellenemedi.",
      },
      { status: 500 },
    );
  }
}
