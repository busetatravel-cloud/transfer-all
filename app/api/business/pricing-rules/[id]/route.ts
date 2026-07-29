import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import {
  deletePricingRule,
  getPricingRuleById,
  updatePricingRule,
  PricingRuleNotFoundError,
  PricingRuleValidationError,
} from "@/lib/pricing-rules";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const existing = await getPricingRuleById(auth.session.businessId, id);

  if (!existing) {
    return buildErrorResponse(404, "not_found", "Pricing rule bulunamadi.");
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const payload = (body?.payload ?? body) as Record<string, unknown> | null;

  if (!payload) {
    return buildErrorResponse(400, "validation_error", "Pricing rule verisi gerekli.");
  }

  try {
    const rule = await updatePricingRule(auth.session.businessId, id, {
      ...existing,
      ...payload,
      businessId: auth.session.businessId,
    } as Parameters<typeof updatePricingRule>[2]);

    return NextResponse.json({
      ok: true,
      pricingRule: rule,
    });
  } catch (error) {
    if (error instanceof PricingRuleValidationError) {
      return buildErrorResponse(400, error.code, error.message, error.fieldErrors, error);
    }

    if (error instanceof PricingRuleNotFoundError) {
      return buildErrorResponse(404, "not_found", error.message);
    }

    console.error("business.pricing-rules.patch.failed", error);
    return buildErrorResponse(
      500,
      "update_failed",
      error instanceof Error ? error.message : "Pricing rule guncellenemedi.",
      undefined,
      error,
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
  const existing = await getPricingRuleById(auth.session.businessId, id);

  if (!existing) {
    return buildErrorResponse(404, "not_found", "Pricing rule bulunamadi.");
  }

  try {
    await deletePricingRule(auth.session.businessId, id);
    return NextResponse.json({
      ok: true,
      pricingRuleId: id,
    });
  } catch (error) {
    console.error("business.pricing-rules.delete.failed", error);
    return buildErrorResponse(
      500,
      "delete_failed",
      error instanceof Error ? error.message : "Pricing rule silinemedi.",
      undefined,
      error,
    );
  }
}
