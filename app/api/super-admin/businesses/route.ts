import { NextResponse } from "next/server";
import {
  createBusinessWithAdmin,
  updateBusinessAdminPasswordRecord,
} from "@/lib/business";
import { requireApiRole } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const auth = await requireApiRole("SUPER_ADMIN");

    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = (await request.json().catch(() => null)) as
      | Record<string, string | undefined>
      | null;

    const name = body?.name?.trim() ?? "";
    const email = body?.email?.trim() ?? "";
    const phone = body?.phone?.trim() ?? "";
    const whatsapp = body?.whatsapp?.trim() ?? "";
    const domain = body?.domain?.trim() ?? "";
    const adminEmail = body?.adminEmail?.trim() ?? "";
    const adminPassword = body?.adminPassword ?? "";

    if (!name || !email || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: "Business adi, business email, admin email ve sifre gerekli." },
        { status: 400 },
      );
    }

    const created = await createBusinessWithAdmin({
      name,
      email,
      phone,
      whatsapp,
      domain,
      adminEmail,
      adminPassword,
    });

    await updateBusinessAdminPasswordRecord(
      created.business.id,
      created.admin.id,
      adminPassword,
    );

    return NextResponse.json({
      ok: true,
      business: created.business,
      admin: {
        id: created.admin.id,
        email: created.admin.email,
        role: created.admin.role,
        businessId: created.admin.businessId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Business olusturulamadi.";
    const status =
      /zaten kullanılıyor|gerekli|yanıtı eksik|domain already exists|admin email already exists/i.test(
        message,
      )
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  const auth = await requireApiRole("SUPER_ADMIN");

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ ok: true });
}
