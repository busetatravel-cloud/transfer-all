import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";
import {
  BuilderDraftConflictError,
  BuilderDraftValidationError,
  createBusinessBuilderDraft,
  getBusinessBuilderDraft,
  saveBusinessBuilderDraft,
} from "@/lib/builder/draft-store";

function parseExpectedVersion(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const draft = (await getBusinessBuilderDraft(auth.session.businessId)) ?? (await createBusinessBuilderDraft(auth.session.businessId, auth.session.userId));
    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "draft_load_failed",
        message: error instanceof Error ? error.message : "Draft yuklenemedi.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        businessId?: unknown;
        document?: unknown;
        expectedVersion?: unknown;
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

  const expectedVersion = parseExpectedVersion(body?.expectedVersion);
  if (!expectedVersion || !body?.document) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "expectedVersion ve document zorunlu.",
      },
      { status: 400 },
    );
  }

  try {
    const draft = await saveBusinessBuilderDraft({
      businessId: auth.session.businessId,
      document: body.document as never,
      expectedVersion,
      updatedBy: auth.session.userId,
    });

    return NextResponse.json({ ok: true, draft });
  } catch (error) {
    if (error instanceof BuilderDraftConflictError) {
      return NextResponse.json(
        {
          ok: false,
          code: "draft_conflict",
          message: "Bu taslak başka bir oturumda güncellendi.",
          currentVersion: error.currentVersion,
        },
        { status: 409 },
      );
    }

    if (error instanceof BuilderDraftValidationError) {
      return NextResponse.json(
        {
          ok: false,
          code: "validation_error",
          message: "Draft dokümanı geçersiz.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "save_failed",
        message: error instanceof Error ? error.message : "Draft kaydedilemedi.",
      },
      { status: 500 },
    );
  }
}
