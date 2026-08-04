import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { getBuilderPublicationVersion, listBuilderPublicationVersions } from "@/lib/builder/publish-store";

// GET /api/business/site-builder/versions            -> tenant-scoped version history (item 7)
// GET /api/business/site-builder/versions?version=3  -> o surumun read-only document'i (item 9, preview)
//
// businessId her zaman session'dan gelir, client'tan asla alinmaz —
// getBuilderPublicationVersion zaten businessId+version ile sorgular, bu
// yuzden baska bir tenant'in surumu asla donmez (tenant scope, item 9).

export async function GET(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const versionParam = url.searchParams.get("version");

  if (versionParam !== null) {
    const version = Number(versionParam);

    if (!Number.isInteger(version) || version <= 0) {
      return NextResponse.json(
        { ok: false, code: "validation_error", message: "version pozitif tam sayı olmalı." },
        { status: 400 },
      );
    }

    try {
      const document = await getBuilderPublicationVersion(auth.session.businessId, version);

      if (!document) {
        return NextResponse.json(
          { ok: false, code: "version_not_found", message: "Bu sürüm bulunamadı." },
          { status: 404 },
        );
      }

      return NextResponse.json({ ok: true, version, document });
    } catch (error) {
      return NextResponse.json(
        {
          ok: false,
          code: "version_load_failed",
          message: error instanceof Error ? error.message : "Sürüm yüklenemedi.",
        },
        { status: 500 },
      );
    }
  }

  try {
    const versions = await listBuilderPublicationVersions(auth.session.businessId);
    return NextResponse.json({ ok: true, versions });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "versions_load_failed",
        message: error instanceof Error ? error.message : "Sürüm geçmişi yüklenemedi.",
      },
      { status: 500 },
    );
  }
}
