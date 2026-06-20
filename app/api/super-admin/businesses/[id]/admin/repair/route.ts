import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { repairBusinessAdminRecord } from "@/lib/business";
import { requireApiRole } from "@/lib/auth";

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
    console.info("super-admin.businesses.admin.repair.request", {
      action: "repair_admin",
      businessId: id,
      serviceRoleExists: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    });

    const result = await repairBusinessAdminRecord(id);
    revalidatePath("/super-admin");

    return NextResponse.json({
      ok: true,
      debug: {
        authCreated: result.authCreated,
        authUserId: result.authUserId,
        publicUserUpdated: result.publicUserUpdated,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repair basarisiz.";
    const code = /bulunamadi|bulunamadı/i.test(message)
      ? "admin_not_found"
      : /sifre|şifre/i.test(message)
        ? "password_missing"
        : "admin_repair_failed";

    console.error("super-admin.businesses.admin.repair.failed", {
      action: "repair_admin",
      businessId: id,
      code,
      message,
    });

    return NextResponse.json(
      {
        ok: false,
        code,
        message,
        debug: {
          authCreated: false,
          authUserId: null,
          publicUserUpdated: false,
          errorCode: code,
          errorMessage: message,
        },
      },
      { status: 400 },
    );
  }
}
