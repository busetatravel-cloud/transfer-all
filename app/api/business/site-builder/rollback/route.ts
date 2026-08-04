import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";
import { recordAuditLog } from "@/lib/audit";
import {
  BuilderPublishTransactionError,
  BuilderRollbackNotFoundError,
  rollbackBuilderPublication,
} from "@/lib/builder/publish-store";

// POST /api/business/site-builder/rollback  { targetRevisionId }
//
// rollbackBuilderPublication zaten businessId+targetRevisionId'yi birlikte
// sorgular (bkz. supabase/migrations/0046 rollback_builder_publication RPC'si)
// — targetRevisionId baska bir tenant'a aitse satir bulunamaz ve
// BuilderRollbackNotFoundError firlatilir (404), asla cross-tenant veri
// sizmaz/mutate edilmez.

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | { businessId?: unknown; targetRevisionId?: unknown; note?: unknown }
    | null;

  try {
    ensureNoBusinessIdSpoofing(body as Record<string, unknown> | null, auth.session.businessId);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: error instanceof Error && error.message === "business_id_mismatch" ? "businessId session ile uyusmuyor." : "Gecersiz istek.",
      },
      { status: 400 },
    );
  }

  const targetRevisionId = typeof body?.targetRevisionId === "string" ? body.targetRevisionId.trim() : "";

  if (!targetRevisionId) {
    return NextResponse.json(
      { ok: false, code: "validation_error", message: "targetRevisionId zorunlu." },
      { status: 400 },
    );
  }

  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 240) : "Geri alındı";

  try {
    const result = await rollbackBuilderPublication(auth.session.businessId, targetRevisionId, note);

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "builder_publication",
      entityId: result.revisionId,
      action: "builder_rollback",
      before: { targetRevisionId },
      after: result,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof BuilderRollbackNotFoundError) {
      return NextResponse.json(
        { ok: false, code: "target_revision_not_found", message: "Geri dönülecek sürüm bulunamadı." },
        { status: 404 },
      );
    }

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "builder_publication",
      entityId: auth.session.businessId,
      action: "builder_publish_failed",
      before: { targetRevisionId },
      after: { message: error instanceof Error ? error.message : String(error) },
    });

    const status = error instanceof BuilderPublishTransactionError ? 502 : 500;
    return NextResponse.json(
      {
        ok: false,
        code: "rollback_failed",
        message: error instanceof Error ? error.message : "Geri alma işlemi başarısız.",
      },
      { status },
    );
  }
}
