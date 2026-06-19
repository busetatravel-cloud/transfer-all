import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApiRole } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import { createDeployRelease } from "@/lib/deploy";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatus(value: unknown) {
  const normalized = normalizeText(value);
  if (normalized === "draft" || normalized === "ready" || normalized === "deployed" || normalized === "rollback") {
    return normalized;
  }
  return "draft";
}

export async function GET() {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    const release = await createDeployRelease({
      version: normalizeText(body?.version),
      notes: normalizeText(body?.notes),
      status: normalizeStatus(body?.status),
      releasedBy: auth.session.userId,
    });

    await recordAuditLog({
      businessId: "system",
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "deploy",
      entityId: release.id,
      action: "create",
      before: null,
      after: release,
    });

    revalidatePath("/super-admin/deploy");
    revalidatePath("/super-admin/system-status");
    return NextResponse.json({ ok: true, release });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Release oluşturulamadı.",
      },
      { status: 400 },
    );
  }
}

