import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit";
import {
  getPublishingCenterData,
  publishBusinessContent,
  rollbackBusinessPublication,
} from "@/lib/publishing";

function normalizeAction(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const data = await getPublishingCenterData(auth.session.businessId);
  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        note?: string;
      }
    | null;

  const action = normalizeAction(body?.action);

  console.info("business.publishing.post", {
    action,
    businessId: auth.session.businessId,
  });

  try {
    if (action === "publish") {
      const result = await publishBusinessContent(
        auth.session.businessId,
        normalizeAction(body?.note) || "Yayınlandı",
      );

      await recordAuditLog({
        businessId: auth.session.businessId,
        actorUserId: auth.session.userId,
        actorRole: auth.session.role,
        entityType: "publication",
        entityId: result.revision.id,
        action: "publish",
        before: null,
        after: result.revision,
      });

      return NextResponse.json({
        ok: true,
        data: result.data,
        revision: result.revision,
      });
    }

    if (action === "rollback") {
      const result = await rollbackBusinessPublication(auth.session.businessId);

      await recordAuditLog({
        businessId: auth.session.businessId,
        actorUserId: auth.session.userId,
        actorRole: auth.session.role,
        entityType: "publication",
        entityId: result.revision.id,
        action: "rollback",
        before: null,
        after: result.revision,
      });
      return NextResponse.json({
        ok: true,
        data: result.data,
        revision: result.revision,
      });
    }

    return NextResponse.json(
      {
        ok: false,
        code: "invalid_action",
        message: "Gecersiz islem.",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof Error && error.name ? error.name : "publish_failed",
        message: error instanceof Error ? error.message : "Yayin islemi basarisiz.",
        stack: error instanceof Error ? error.stack ?? null : null,
      },
      { status: 400 },
    );
  }
}
