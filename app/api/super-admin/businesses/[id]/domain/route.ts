import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth";
import { updateBusinessDomainRecord } from "@/lib/business";

function normalizeStatus(value: unknown) {
  if (value === "pending" || value === "verified" || value === "active") {
    return value;
  }

  return null;
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
    | { domain?: string; domainStatus?: string }
    | null;

  const domain = body?.domain?.trim() ?? "";
  const domainStatus = normalizeStatus(body?.domainStatus);

  if (body?.domainStatus && !domainStatus) {
    return NextResponse.json(
      { error: "Gecersiz domain durumu." },
      { status: 400 },
    );
  }

  try {
    const business = await updateBusinessDomainRecord(id, {
      domain,
      domainStatus: domainStatus ?? "pending",
    });

    return NextResponse.json({ ok: true, business });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Domain guncellenemedi.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
