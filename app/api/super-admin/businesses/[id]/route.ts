import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createBusinessAdminRecord,
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
    if (target === "business") {
      if (action === "delete") {
        await deleteBusinessRecord(id);
        revalidatePath("/super-admin");
        return NextResponse.json({
          ok: true,
          message: "Business kalıcı olarak silindi",
        });
      }

      await updateBusinessActiveRecord(id, action === "activate");
      const business = await getBusinessById(id);
      revalidatePath("/super-admin");
      return NextResponse.json({ ok: true, business });
    }

    if (action === "delete") {
      await deleteBusinessAdminRecord(id);
    } else {
      await updateBusinessAdminActiveRecord(id, action === "activate");
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

  if (!adminEmail || !adminPassword) {
    return NextResponse.json(
      { error: "Admin email ve sifre gerekli." },
      { status: 400 },
    );
  }

  try {
    await createBusinessAdminRecord(id, adminEmail, adminPassword);
    const business = await getBusinessById(id);
    revalidatePath("/super-admin");
    return NextResponse.json({ ok: true, business });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Admin olusturulamadi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
