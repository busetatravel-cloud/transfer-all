import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { normalizePaymentProvider } from "@/lib/payment-provider";
import { getReservationById } from "@/lib/reservation-service";
import { createReservationPaymentRecord } from "@/lib/payments";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const reservationId = normalizeText(body?.reservationId ?? body?.reservation_id);

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

  if (!reservationId) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Reservation ID gerekli.",
        fieldErrors: {
          reservationId: "Reservation ID gerekli.",
        },
      },
      { status: 400 },
    );
  }

  const reservation = await getReservationById(auth.session.businessId, reservationId);

  if (!reservation) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "Rezervasyon bulunamadı.",
      },
      { status: 404 },
    );
  }

  const amount = normalizeNumber(body?.amount, reservation.totalAmount ?? 0);
  const currency = normalizeText(body?.currency) || reservation.currency || "TRY";
  const provider = normalizePaymentProvider(body?.provider as string | null | undefined);

  try {
    const payment = await createReservationPaymentRecord({
      businessId: auth.session.businessId,
      reservationId,
      provider,
      amount,
      currency,
      status: "Pending",
      transactionReference: null,
    });

    return NextResponse.json({
      ok: true,
      payment,
      checkoutUrl: `/app/checkout/${reservationId}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "create_failed",
        message: error instanceof Error ? error.message : "Ödeme kaydı oluşturulamadı.",
      },
      { status: 500 },
    );
  }
}
