import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth";
import { createPlan, listPlans } from "@/lib/plans";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeNumericValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET() {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const plans = await listPlans();
  return NextResponse.json({ ok: true, plans });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const plan = await createPlan({
      name: normalizeText(body?.name),
      monthlyPrice: normalizeNumericValue(body?.monthlyPrice ?? body?.monthly_price),
      yearlyPrice: normalizeNumericValue(body?.yearlyPrice ?? body?.yearly_price),
      trialDays: normalizeNumericValue(body?.trialDays ?? body?.trial_days),
      features: (body?.features as string[] | string | undefined) ?? "",
      active: normalizeBoolean(body?.active),
    });

    revalidatePath("/super-admin/plans");
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Paket oluşturulamadı.",
      },
      { status: 400 },
    );
  }
}
