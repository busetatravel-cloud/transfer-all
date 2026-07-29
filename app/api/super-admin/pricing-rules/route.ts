import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import {
  createPricingRule,
  listPricingRules,
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

export async function GET(request: Request) {
  const session = await requireRole("SUPER_ADMIN");
  void session;

  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId")?.trim() || undefined;
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const rules = await listPricingRules({
    businessId,
    includeInactive,
  });

  return NextResponse.json({
    ok: true,
    pricingRules: rules,
  });
}

export async function POST(request: Request) {
  const session = await requireRole("SUPER_ADMIN");
  void session;

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const payload = (body?.payload ?? body) as Record<string, unknown> | null;

  if (!payload) {
    return buildErrorResponse(400, "validation_error", "Pricing rule verisi gerekli.");
  }

  try {
    const rule = await createPricingRule(payload as Parameters<typeof createPricingRule>[0]);

    return NextResponse.json({
      ok: true,
      pricingRule: rule,
    });
  } catch (error) {
    if (error instanceof PricingRuleValidationError) {
      return buildErrorResponse(400, error.code, error.message, error.fieldErrors, error);
    }

    console.error("super-admin.pricing-rules.post.failed", error);
    return buildErrorResponse(
      500,
      "create_failed",
      error instanceof Error ? error.message : "Pricing rule olusturulamadi.",
      undefined,
      error,
    );
  }
}
