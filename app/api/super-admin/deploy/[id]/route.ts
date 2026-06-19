import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { listDeployReleases, updateDeployRelease } from "@/lib/deploy";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value);
  if (normalized === "draft" || normalized === "ready" || normalized === "deployed" || normalized === "rollback") {
    return normalized;
  }
  return null;
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
    const before = (await listDeployReleases(200)).find((item) => item.id === id) ?? null;
    const release = await updateDeployRelease(id, {
      version: body?.version === undefined ? undefined : normalizeText(body?.version),
      notes: body?.notes === undefined ? undefined : normalizeText(body?.notes),
      status: normalizeStatus(body?.status) ?? undefined,
      releasedBy: auth.session.userId,
    });

    await recordAuditLog({
      businessId: "system",
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "deploy",
      entityId: id,
      action: "update",
      before,
      after: release,
    });

    revalidatePath("/super-admin/deploy");
    revalidatePath("/super-admin/system-status");
    return NextResponse.json({ ok: true, release });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Release güncellenemedi.",
      },
      { status: 400 },
    );
  }
}

