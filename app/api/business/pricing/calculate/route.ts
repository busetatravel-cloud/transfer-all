import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import {
  buildTransferPricingInputFromDraft,
  calculateTransferPrice,
  PricingRuleNotFoundError,
  type TransferPricingDraft,
} from "@/lib/pricing-engine";
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
  const payload = (body?.payload ?? body) as TransferPricingDraft | null;

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

  if (!payload) {
    return buildErrorResponse(400, "validation_error", "Fiyat verisi gerekli.");
  }

  try {
    const ruleSet = await loadBusinessPricingRuleSet(auth.session.businessId, {
      includeInactive: false,
    });
    const quote = calculateTransferPrice(
      buildTransferPricingInputFromDraft({
        ...payload,
        businessId: auth.session.businessId,
        ruleSet,
      }),
    );

    return NextResponse.json({
      ok: true,
      quote,
    });
  } catch (error) {
    console.error("business.pricing.calculate.failed", error);

    if (error instanceof PricingRuleNotFoundError) {
      return buildErrorResponse(422, "pricing_rule_not_found", error.message);
    }

    return buildErrorResponse(
      500,
      "pricing_failed",
      error instanceof Error ? error.message : "Fiyat hesaplanamadı.",
      undefined,
      error,
    );
  }
}
