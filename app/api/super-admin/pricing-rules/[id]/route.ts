import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
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

function readBusinessId(body: Record<string, unknown> | null, requestUrl: string) {
  const fromBody = String(body?.businessId ?? body?.business_id ?? "").trim();
  if (fromBody) {
    return fromBody;
  }

  const url = new URL(requestUrl);
  return url.searchParams.get("businessId")?.trim() ?? "";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole("SUPER_ADMIN");
  void session;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const businessId = readBusinessId(body, request.url);

  if (!businessId) {
    return buildErrorResponse(400, "validation_error", "businessId gerekli.");
  }

  const existing = await getPricingRuleById(businessId, id);

  if (!existing) {
    return buildErrorResponse(404, "not_found", "Pricing rule bulunamadi.");
  }

  const payload = (body?.payload ?? body) as Record<string, unknown> | null;

  if (!payload) {
    return buildErrorResponse(400, "validation_error", "Pricing rule verisi gerekli.");
  }

  try {
    const rule = await updatePricingRule(businessId, id, {
      ...existing,
      ...payload,
      businessId,
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

    console.error("super-admin.pricing-rules.patch.failed", error);
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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRole("SUPER_ADMIN");
  void session;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const businessId = readBusinessId(body, request.url);

  if (!businessId) {
    return buildErrorResponse(400, "validation_error", "businessId gerekli.");
  }

  const existing = await getPricingRuleById(businessId, id);

  if (!existing) {
    return buildErrorResponse(404, "not_found", "Pricing rule bulunamadi.");
  }

  try {
    await deletePricingRule(businessId, id);
    return NextResponse.json({
      ok: true,
      pricingRuleId: id,
    });
  } catch (error) {
    console.error("super-admin.pricing-rules.delete.failed", error);
    return buildErrorResponse(
      500,
      "delete_failed",
      error instanceof Error ? error.message : "Pricing rule silinemedi.",
      undefined,
      error,
    );
  }
}
