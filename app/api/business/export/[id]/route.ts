import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { markExportCopied } from "@/lib/export";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status === "copied" ? "copied" : "draft";

  if (status !== "copied") {
    return NextResponse.json(
      { ok: false, message: "Geçersiz export durumu." },
      { status: 400 },
    );
  }

  const ok = await markExportCopied(auth.session.businessId, id);

  if (!ok) {
    return NextResponse.json(
      { ok: false, message: "Export güncellenemedi." },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
