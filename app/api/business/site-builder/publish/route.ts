import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";
import { recordAuditLog } from "@/lib/audit";
import {
  BuilderPublishConflictError,
  BuilderPublishNotFoundError,
  BuilderPublishTransactionError,
  BuilderPublishValidationError,
  publishBuilderDraft,
} from "@/lib/builder/publish-store";

function parsePositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeNote(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        businessId?: unknown;
        expectedDraftVersion?: unknown;
        expectedPublishedVersion?: unknown;
        note?: unknown;
      }
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

  const expectedDraftVersion = parsePositiveInteger(body?.expectedDraftVersion);
  const expectedPublishedVersion = parsePositiveInteger(body?.expectedPublishedVersion);

  if (expectedDraftVersion === null || expectedPublishedVersion === null) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "expectedDraftVersion ve expectedPublishedVersion pozitif tam sayı olmalı.",
      },
      { status: 400 },
    );
  }

  const note = normalizeNote(body?.note) || "Yayınlandı";

  try {
    const result = await publishBuilderDraft({
      businessId: auth.session.businessId,
      expectedDraftVersion,
      expectedPublishedVersion,
      note,
    });

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "builder_publication",
      entityId: result.revisionId,
      action: "builder_publish",
      before: { expectedDraftVersion, expectedPublishedVersion },
      after: result,
    });

    return NextResponse.json({
      ok: true,
      revisionId: result.revisionId,
      publishedVersion: result.publishedVersion,
      draftVersion: result.draftVersion,
      publishedAt: result.publishedAt,
    });
  } catch (error) {
    if (error instanceof BuilderPublishConflictError) {
      await recordAuditLog({
        businessId: auth.session.businessId,
        actorUserId: auth.session.userId,
        actorRole: auth.session.role,
        entityType: "builder_publication",
        entityId: auth.session.businessId,
        action: "builder_publish_conflict",
        before: { expectedDraftVersion, expectedPublishedVersion },
        after: {
          kind: error.kind,
          currentDraftVersion: error.currentDraftVersion,
          currentPublishedVersion: error.currentPublishedVersion,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          code: error.kind === "draft" ? "draft_conflict" : "published_conflict",
          message:
            error.kind === "draft"
              ? "Taslak başka bir oturumda güncellendi. Önce yeniden yükleyin."
              : "Yayın başka bir oturumda değişti. Önce yeniden yükleyin.",
          currentDraftVersion: error.currentDraftVersion,
          currentPublishedVersion: error.currentPublishedVersion,
        },
        { status: 409 },
      );
    }

    if (error instanceof BuilderPublishNotFoundError) {
      return NextResponse.json(
        {
          ok: false,
          code: "draft_not_found",
          message: "Yayınlanacak bir taslak bulunamadı.",
        },
        { status: 422 },
      );
    }

    if (error instanceof BuilderPublishValidationError) {
      return NextResponse.json(
        {
          ok: false,
          code: "validation_error",
          message: "Taslak dokümanı geçersiz, yayınlanamadı.",
          issues: error.issues,
        },
        { status: 422 },
      );
    }

    await recordAuditLog({
      businessId: auth.session.businessId,
      actorUserId: auth.session.userId,
      actorRole: auth.session.role,
      entityType: "builder_publication",
      entityId: auth.session.businessId,
      action: "builder_publish_failed",
      before: { expectedDraftVersion, expectedPublishedVersion },
      after: { message: error instanceof Error ? error.message : String(error) },
    });

    const status = error instanceof BuilderPublishTransactionError ? 502 : 500;
    return NextResponse.json(
      {
        ok: false,
        code: "publish_failed",
        message: error instanceof Error ? error.message : "Yayın işlemi başarısız.",
      },
      { status },
    );
  }
}
