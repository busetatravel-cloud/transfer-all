import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getReservationById, updateReservation } from "@/lib/reservation-service";
import { completeReservationPaymentRecord, getPaymentById } from "@/lib/payments";
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
  const paymentId = normalizeText(body?.paymentId ?? body?.payment_id);

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

  if (!paymentId) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Payment ID gerekli.",
        fieldErrors: {
          paymentId: "Payment ID gerekli.",
        },
      },
      { status: 400 },
    );
  }

  const existingPayment = await getPaymentById(paymentId, auth.session.businessId);

  if (!existingPayment) {
    return NextResponse.json(
      {
        ok: false,
        code: "not_found",
        message: "Ödeme bulunamadı.",
      },
      { status: 404 },
    );
  }

  const reservation = await getReservationById(auth.session.businessId, existingPayment.reservationId);

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

  const amount = normalizeNumber(body?.amount, existingPayment.amount);
  const transactionReference =
    normalizeText(body?.transactionReference ?? body?.transaction_reference) ||
    existingPayment.transactionReference ||
    null;
  const reservationTotalAmount = reservation.totalAmount ?? existingPayment.amount;
  const isPartial =
    reservationTotalAmount > 0 && amount > 0 && amount < reservationTotalAmount;

  try {
    const payment = await completeReservationPaymentRecord({
      businessId: auth.session.businessId,
      paymentId,
      provider: existingPayment.provider,
      amount,
      currency: existingPayment.currency,
      reservationId: existingPayment.reservationId,
      reservationTotalAmount,
      transactionReference,
    });

    await updateReservation(auth.session.businessId, {
      recordId: reservation.id,
      paymentStatus: isPartial ? "Kapora Alındı" : "Ödendi",
      bookingStatus: isPartial ? reservation.bookingStatus : "Onaylandı",
    });

    return NextResponse.json({
      ok: true,
      payment,
      reservationId: reservation.id,
      confirmed: !isPartial,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "complete_failed",
        message: error instanceof Error ? error.message : "Ödeme tamamlanamadı.",
      },
      { status: 500 },
    );
  }
}
