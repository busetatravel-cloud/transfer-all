import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { ensureNoBusinessIdSpoofing } from "@/lib/tenant-security";
import { loadBuilderTranslationDrafts, saveBuilderTranslations } from "@/lib/builder/translations";

// GET  /api/business/site-builder/translations?locale=xx  -> o dilin DRAFT
//      builder ceviri override'larini doner (inspector'in locale secici
//      panelini doldurmak icin).
// PUT  /api/business/site-builder/translations               -> o dil icin
//      bir veya daha fazla alanin cevirisini kaydeder (mevcut diger
//      alanlarla merge edilir, tam liste degil).
//
// Draft seviyesinde calisir — public sitede GORUNMEZ. Yalnizca bir sonraki
// "Yayınla" ile business_publication_translations'a (o revizyona) kopyalanir
// (bkz. lib/builder/publish-store.ts snapshotBuilderTranslationsForRevision).

export async function GET(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const locale = url.searchParams.get("locale")?.trim() ?? "";

  if (!locale) {
    return NextResponse.json(
      { ok: false, code: "validation_error", message: "locale zorunlu." },
      { status: 400 },
    );
  }

  try {
    const rows = await loadBuilderTranslationDrafts(auth.session.businessId, locale);
    return NextResponse.json({ ok: true, locale, entries: rows });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "translations_load_failed",
        message: error instanceof Error ? error.message : "Çeviriler yüklenemedi.",
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
        locale?: unknown;
        entries?: Array<{ sourceId?: unknown; fieldKey?: unknown; translatedText?: unknown }>;
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

  const locale = typeof body?.locale === "string" ? body.locale.trim() : "";
  const entries = Array.isArray(body?.entries) ? body.entries : null;

  if (!locale || !entries) {
    return NextResponse.json(
      { ok: false, code: "validation_error", message: "locale ve entries zorunlu." },
      { status: 400 },
    );
  }

  if (entries.length > 100) {
    return NextResponse.json(
      { ok: false, code: "validation_error", message: "Tek seferde en fazla 100 alan gönderilebilir." },
      { status: 400 },
    );
  }

  try {
    const result = await saveBuilderTranslations({
      businessId: auth.session.businessId,
      localeCode: locale,
      entries,
    });

    return NextResponse.json({ ok: true, saved: result.saved, issues: result.issues });
  } catch (error) {
    if (error instanceof Error && error.message === "invalid_locale") {
      return NextResponse.json(
        { ok: false, code: "validation_error", message: "Geçersiz dil kodu." },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === "draft_not_found") {
      return NextResponse.json(
        { ok: false, code: "draft_not_found", message: "Taslak bulunamadı." },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "translations_save_failed",
        message: error instanceof Error ? error.message : "Çeviriler kaydedilemedi.",
      },
      { status: 500 },
    );
  }
}
