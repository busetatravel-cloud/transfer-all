import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";
import { saveBusinessThemeSettings } from "@/lib/theme-settings";
import { THEME_REGISTRY_ENTRIES } from "@/lib/theme-registry";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  try {
    ensureNoBusinessIdSpoofing(body, auth.session.businessId);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message:
          error instanceof Error && error.message === "business_id_mismatch"
            ? "businessId session ile uyusmuyor."
            : "Gecersiz istek.",
      },
      { status: 400 },
    );
  }

  const templateKey = normalizeText(body?.templateKey);
  const isKnownTemplate = THEME_REGISTRY_ENTRIES.some((entry) => entry.key === templateKey);

  if (!templateKey || !isKnownTemplate) {
    return NextResponse.json(
      {
        ok: false,
        code: "validation_error",
        message: "Gecerli bir tema seçin.",
      },
      { status: 400 },
    );
  }

  try {
    const settings = await saveBusinessThemeSettings(auth.session.businessId, templateKey);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "save_failed",
        message: error instanceof Error ? error.message : "Tema ayarları kaydedilemedi.",
      },
      { status: 500 },
    );
  }
}
