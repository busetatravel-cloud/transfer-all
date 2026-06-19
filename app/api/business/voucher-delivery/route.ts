import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getReservationById } from "@/lib/reservation-service";
import { ensureBusinessVoucherForReservation } from "@/lib/vouchers";
import { createVoucherDeliveryLog } from "@/lib/voucher-delivery";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  error?: unknown,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    },
    { status },
  );
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  const reservationId = normalizeText(parseBodyField(body, "reservationId"));
  const voucherId = normalizeText(parseBodyField(body, "voucherId"));
  const channel = normalizeText(parseBodyField(body, "channel")) as
    | "mail"
    | "whatsapp";
  const recipient = normalizeText(parseBodyField(body, "recipient"));
  const messagePreview = normalizeText(parseBodyField(body, "messagePreview"));
  const status = normalizeText(parseBodyField(body, "status")) || "draft";

  if (!reservationId || !voucherId || !channel || !recipient || !messagePreview) {
    return buildErrorResponse(400, "validation_error", "Zorunlu alanlar eksik.");
  }

  const reservation = await getReservationById(auth.session.businessId, reservationId);

  if (!reservation) {
    return buildErrorResponse(404, "not_found", "Rezervasyon bulunamadı.");
  }

  const voucher = await ensureBusinessVoucherForReservation(
    auth.session.businessId,
    reservationId,
  );

  if (!voucher || voucher.id !== voucherId) {
    return buildErrorResponse(404, "not_found", "Voucher bulunamadı.");
  }

  try {
    const log = await createVoucherDeliveryLog({
      businessId: auth.session.businessId,
      reservationId,
      voucherId,
      channel,
      recipient,
      status: status as "draft" | "copied" | "sent_placeholder" | "failed",
      messagePreview,
    });

    return NextResponse.json({
      ok: true,
      log,
    });
  } catch (error) {
    return buildErrorResponse(
      500,
      "log_failed",
      error instanceof Error ? error.message : "Voucher log kaydedilemedi.",
      error,
    );
  }
}
