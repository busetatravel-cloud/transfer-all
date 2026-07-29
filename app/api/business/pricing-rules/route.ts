import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
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
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const rules = await listPricingRules({
    businessId: auth.session.businessId,
    includeInactive,
  });

  return NextResponse.json({
    ok: true,
    pricingRules: rules,
  });
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const payload = (body?.payload ?? body) as Record<string, unknown> | null;

  if (!payload) {
    return buildErrorResponse(400, "validation_error", "Pricing rule verisi gerekli.");
  }

  try {
    const rule = await createPricingRule({
      ...payload,
      businessId: auth.session.businessId,
    } as Parameters<typeof createPricingRule>[0]);

    return NextResponse.json({
      ok: true,
      pricingRule: rule,
    });
  } catch (error) {
    if (error instanceof PricingRuleValidationError) {
      return buildErrorResponse(400, error.code, error.message, error.fieldErrors, error);
    }

    console.error("business.pricing-rules.post.failed", error);
    return buildErrorResponse(
      500,
      "create_failed",
      error instanceof Error ? error.message : "Pricing rule olusturulamadi.",
      undefined,
      error,
    );
  }
}
