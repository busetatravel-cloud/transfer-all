import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth";
import { deletePlan, updatePlan } from "@/lib/plans";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNumericValue(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBoolean(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return value === true || value === "true" || value === 1 || value === "1";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const plan = await updatePlan(id, {
      name: body?.name === undefined ? undefined : normalizeText(body?.name),
      monthlyPrice: normalizeNumericValue(body?.monthlyPrice ?? body?.monthly_price),
      yearlyPrice: normalizeNumericValue(body?.yearlyPrice ?? body?.yearly_price),
      trialDays: normalizeNumericValue(body?.trialDays ?? body?.trial_days),
      features:
        body?.features === undefined
          ? undefined
          : (body?.features as string[] | string),
      active: normalizeBoolean(body?.active),
    });

    revalidatePath("/super-admin/plans");
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Paket güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    await deletePlan(id);
    revalidatePath("/super-admin/plans");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Paket silinemedi.",
      },
      { status: 400 },
    );
  }
}
