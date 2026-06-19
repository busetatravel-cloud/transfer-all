import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { createReservation, listReservations } from "@/lib/reservation-service";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const safe = normalizeText(value);
  return safe || undefined;
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const reservations = await listReservations(auth.session.businessId);

  return NextResponse.json({
    ok: true,
    reservations,
  });
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

  console.info("business.reservations.post", {
    businessId: auth.session.businessId,
    bodyAction: body?.action,
    bodySection: body?.section,
    bodyPayload: body?.payload ?? body,
  });

  const customerName = normalizeText(
    parseBodyField(body, "customer_name") ?? parseBodyField(body, "customerName"),
  );
  const from =
    normalizeText(
      parseBodyField(body, "from_location") ??
        parseBodyField(body, "from") ??
        parseBodyField(body, "origin"),
    ) || "";
  const to =
    normalizeText(
      parseBodyField(body, "to_location") ??
        parseBodyField(body, "to") ??
        parseBodyField(body, "destination"),
    ) || "";
  const travelDate =
    normalizeText(
      parseBodyField(body, "travel_date") ?? parseBodyField(body, "travelDate"),
    ) || "";
  const travelTime =
    normalizeText(
      parseBodyField(body, "travel_time") ?? parseBodyField(body, "travelTime"),
    ) || "";

  console.info("business.reservations.create.required", {
    businessId: auth.session.businessId,
    customerName,
    from,
    to,
    travelDate,
    travelTime,
  });

  const fieldErrors: Record<string, string> = {};

  if (!customerName) fieldErrors.customer_name = "Müşteri adı soyadı gerekli.";
  if (!from) fieldErrors.from_location = "Nereden alanı gerekli.";
  if (!to) fieldErrors.to_location = "Nereye alanı gerekli.";
  if (!travelDate) fieldErrors.travel_date = "Tarih gerekli.";
  if (!travelTime) fieldErrors.travel_time = "Saat gerekli.";

  if (Object.keys(fieldErrors).length > 0) {
    return buildErrorResponse(
      400,
      "validation_error",
      "Lütfen zorunlu alanları doldurun.",
      fieldErrors,
    );
  }

  try {
    const reservation = await createReservation(auth.session.businessId, {
      customerName,
      phone: normalizeOptionalText(parseBodyField(body, "phone")),
      email: normalizeOptionalText(parseBodyField(body, "email")),
      country: normalizeOptionalText(parseBodyField(body, "country")),
      language: normalizeOptionalText(parseBodyField(body, "language")) ?? "tr",
      fromLocation: from,
      toLocation: to,
      travelDate,
      travelTime,
      flightCode: normalizeOptionalText(parseBodyField(body, "flightCode")),
      adultCount: normalizeNumber(parseBodyField(body, "adultCount"), 0),
      childCount: normalizeNumber(parseBodyField(body, "childCount"), 0),
      babyCount: normalizeNumber(parseBodyField(body, "babyCount"), 0),
      vehicleCategory: normalizeOptionalText(parseBodyField(body, "vehicleCategory")),
      vehicleName: normalizeOptionalText(
        parseBodyField(body, "vehicle_name") ??
          parseBodyField(body, "vehicleName") ??
          parseBodyField(body, "vehicle"),
      ),
      totalAmount: normalizeOptionalText(
        parseBodyField(body, "total_amount") ??
          parseBodyField(body, "totalAmount") ??
          parseBodyField(body, "total"),
      ),
      depositAmount: normalizeOptionalText(
        parseBodyField(body, "deposit_amount") ??
          parseBodyField(body, "depositAmount") ??
          parseBodyField(body, "deposit"),
      ),
      remainingAmount: normalizeOptionalText(
        parseBodyField(body, "remaining_amount") ??
          parseBodyField(body, "remainingAmount") ??
          parseBodyField(body, "remaining"),
      ),
      currency: normalizeOptionalText(parseBodyField(body, "currency")) ?? "TRY",
      paymentStatus:
        normalizeOptionalText(
          parseBodyField(body, "payment_status") ??
            parseBodyField(body, "paymentStatus"),
        ) ?? "Ödenmedi",
      notes: normalizeOptionalText(parseBodyField(body, "notes") ?? parseBodyField(body, "note")),
      source: normalizeOptionalText(parseBodyField(body, "source")) ?? "Manuel",
      bookingStatus:
        normalizeOptionalText(
          parseBodyField(body, "booking_status") ??
            parseBodyField(body, "bookingStatus") ??
            parseBodyField(body, "status"),
        ) ?? "Bekliyor",
      message: normalizeOptionalText(parseBodyField(body, "message")),
    });

    return NextResponse.json({
      ok: true,
      reservation,
    });
  } catch (error) {
    console.error("business.reservations.post.failed", error);
    return buildErrorResponse(
      500,
      "create_failed",
      error instanceof Error ? error.message : "Rezervasyon oluşturulamadı.",
      undefined,
      error,
    );
  }
}
