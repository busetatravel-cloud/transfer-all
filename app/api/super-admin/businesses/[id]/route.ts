import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { recordAuditLog } from "@/lib/audit";
import {
  createBusinessAdminRecord,
  BusinessAdminFlowError,
  deleteBusinessRecord,
  deleteBusinessAdminRecord,
  getBusinessById,
  updateBusinessActiveRecord,
  updateBusinessAdminActiveRecord,
} from "@/lib/business";
import { requireApiRole } from "@/lib/auth";

type ActionTarget = "business" | "admin";
type ActionType = "activate" | "deactivate" | "delete";

function normalizeTarget(value: unknown): ActionTarget | null {
  return value === "business" || value === "admin" ? value : null;
}

function normalizeAction(value: unknown): ActionType | null {
  return value === "activate" || value === "deactivate" || value === "delete"
    ? value
    : null;
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
  const body = (await request.json().catch(() => null)) as
    | { target?: unknown; action?: unknown }
    | null;

  const target = normalizeTarget(body?.target);
  const action = normalizeAction(body?.action);

  if (!target || !action) {
    return NextResponse.json(
      { error: "Gecersiz aksiyon." },
      { status: 400 },
    );
  }

  try {
    const beforeBusiness = await getBusinessById(id);

    if (target === "business") {
      if (action === "delete") {
        await deleteBusinessRecord(id);
        await recordAuditLog({
          businessId: id,
          actorUserId: auth.session.userId,
          actorRole: auth.session.role,
          entityType: "business",
          entityId: id,
          action: "delete",
          before: beforeBusiness,
          after: null,
        });
        revalidatePath("/super-admin");
        return NextResponse.json({
          ok: true,
          message: "Business kalıcı olarak silindi",
        });
      }

      await updateBusinessActiveRecord(id, action === "activate");
      const business = await getBusinessById(id);
      await recordAuditLog({
        businessId: id,
        actorUserId: auth.session.userId,
        actorRole: auth.session.role,
        entityType: "business",
        entityId: id,
        action: action === "activate" ? "activate" : "deactivate",
        before: beforeBusiness,
        after: business,
      });
      revalidatePath("/super-admin");
      return NextResponse.json({ ok: true, business });
    }

    if (action === "delete") {
      await deleteBusinessAdminRecord(id);
      await recordAuditLog({
        businessId: id,
        actorUserId: auth.session.userId,
        actorRole: auth.session.role,
        entityType: "business_admin",
        entityId: id,
        action: "delete",
        before: beforeBusiness,
        after: null,
      });
    } else {
      await updateBusinessAdminActiveRecord(id, action === "activate");
      const business = await getBusinessById(id);
      await recordAuditLog({
        businessId: id,
        actorUserId: auth.session.userId,
        actorRole: auth.session.role,
        entityType: "business_admin",
        entityId: id,
        action: action === "activate" ? "activate" : "deactivate",
        before: beforeBusiness,
        after: business,
      });
    }

    const business = await getBusinessById(id);
    revalidatePath("/super-admin");
    return NextResponse.json({ ok: true, business });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Islem basarisiz.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { adminEmail?: string; adminPassword?: string }
    | null;

  const adminEmail = body?.adminEmail?.trim() ?? "";
  const adminPassword = body?.adminPassword ?? "";
  let currentStep = "entered";
  let authCreated = false;
  let authUserId: string | null = null;
  let publicUserUpdated = false;

  console.info("super-admin.businesses.admin.create.step", {
    action: "create_admin",
    email: adminEmail,
    businessId: id,
    step: currentStep,
  });

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      {
        ok: false,
        currentStep: "validation_failed",
        authCreated: false,
        authUserId: null,
        publicUserUpdated: false,
        errorCode: "validation_failed",
        errorMessage: "Admin email ve sifre gerekli.",
        stack: null,
      },
      { status: 400 },
    );
  }

  try {
    console.info("super-admin.businesses.admin.create.request", {
      action: "create_admin",
      email: adminEmail,
      businessId: id,
      serviceRoleExists: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    });

    const result = await createBusinessAdminRecord(id, adminEmail, adminPassword, {
      onStep: (step) => {
        currentStep = step;
        console.info("super-admin.businesses.admin.create.step", {
          action: "create_admin",
          email: adminEmail,
          businessId: id,
          step,
        });
      },
    });

    const business = await getBusinessById(id);
    authCreated = result.authCreated;
    authUserId = result.authUserId;
    publicUserUpdated = result.publicUserUpdated;
    currentStep = "completed";
    revalidatePath("/super-admin");
    return NextResponse.json({
      ok: true,
      currentStep,
      authCreated,
      authUserId,
      publicUserUpdated,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      stack: null,
      business,
    });
  } catch (error) {
    const flowError = error instanceof BusinessAdminFlowError ? error : null;
    const stack = error instanceof Error ? error.stack ?? null : null;
    const errorCode =
      flowError?.code ??
      (error instanceof Error && /^AUTH_CREATE_FAILED:/i.test(error.message)
        ? "auth_create_failed"
        : "admin_create_failed");
    const errorMessage = flowError?.message ?? (error instanceof Error ? error.message : "Admin olusturulamadi.");
    const responseStep = flowError?.currentStep ?? currentStep;
    console.error("super-admin.businesses.admin.create.failed", {
      action: "create_admin",
      email: adminEmail,
      businessId: id,
      currentStep: responseStep,
      errorCode,
      errorMessage,
      stack,
    });
    return NextResponse.json(
      {
        ok: false,
        currentStep: responseStep,
        authCreated: flowError ? authCreated : false,
        authUserId: flowError ? authUserId : null,
        publicUserUpdated: flowError ? publicUserUpdated : false,
        errorCode,
        errorMessage,
        stack,
      },
      { status: 400 },
    );
  }
}
