import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { listDeployReleases, rollbackDeployRelease } from "@/lib/deploy";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const before = (await listDeployReleases(200)).find((item) => item.id === id) ?? null;
    const release = await rollbackDeployRelease(id, auth.session.userId);

    await recordAuditLog({
      businessId: "system",
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "deploy",
      entityId: id,
      action: "rollback",
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
        message: error instanceof Error ? error.message : "Rollback başarısız.",
      },
      { status: 400 },
    );
  }
}

