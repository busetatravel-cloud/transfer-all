import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { getBusinessById } from "@/lib/business";
import { assignPlanToBusiness } from "@/lib/plans";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const planId = normalizeText(body?.planId) || null;

  try {
    const beforeBusiness = await getBusinessById(id);
    const business = await assignPlanToBusiness(id, planId);
    await recordAuditLog({
      businessId: id,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "plan",
      entityId: id,
      action: "update",
      before: beforeBusiness,
      after: business,
    });
    revalidatePath("/super-admin");
    revalidatePath("/super-admin/plans");
    return NextResponse.json({ ok: true, business });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Plan atanamadi.",
      },
      { status: 400 },
    );
  }
}
