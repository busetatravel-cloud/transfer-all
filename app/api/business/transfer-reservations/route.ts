import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  buildTransferPricingInputFromDraft,
  calculateTransferPrice,
  PricingRuleNotFoundError,
} from "@/lib/pricing-engine";
import { createReservation } from "@/lib/reservation-service";
import {
  buildTransferReservationPayload,
  normalizeTransferReservationBody,
  type TransferReservationCreateInput,
} from "@/lib/transfer-reservation-engine";
import { loadBusinessPricingRuleSet } from "@/lib/pricing-rules";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";

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

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    ensureNoBusinessIdSpoofing(body, auth.session.businessId);
  } catch (error) {
    return buildErrorResponse(
      400,
      "validation_error",
      error instanceof Error && error.message === "business_id_mismatch"
        ? "businessId session ile uyusmuyor."
        : "Gecersiz istek.",
    );
  }
  const parsed = normalizeTransferReservationBody(body);

  if (!parsed.ok) {
    return buildErrorResponse(
      400,
      "validation_error",
      "Lütfen zorunlu alanları doldurun.",
      parsed.fieldErrors,
    );
  }

  try {
    const ruleSet = await loadBusinessPricingRuleSet(auth.session.businessId, {
      includeInactive: false,
    });
    const payload = buildTransferReservationPayload(
      parsed.payload as TransferReservationCreateInput,
    );
    const quote = calculateTransferPrice(
      buildTransferPricingInputFromDraft({
        ...(parsed.payload as TransferReservationCreateInput),
        businessId: auth.session.businessId,
        ruleSet,
      }),
    );
    const reservation = await createReservation(auth.session.businessId, {
      ...payload,
      totalAmount: quote.total,
      depositAmount: 0,
      remainingAmount: quote.total,
    });

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "reservation",
      entityId: reservation.id,
      action: "create",
      before: null,
      after: reservation,
    });

    return NextResponse.json({
      ok: true,
      reservation,
      quote,
    });
  } catch (error) {
    console.error("business.transfer-reservations.post.failed", error);

    if (error instanceof PricingRuleNotFoundError) {
      return buildErrorResponse(422, "pricing_rule_not_found", error.message);
    }

    return buildErrorResponse(
      500,
      "create_failed",
      error instanceof Error ? error.message : "Rezervasyon oluşturulamadı.",
      undefined,
      error,
    );
  }
}
