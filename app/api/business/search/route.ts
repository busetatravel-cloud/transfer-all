import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import { searchBusinessContent } from "@/lib/search";

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const query = normalizeText(url.searchParams.get("q"));

  if (!query) {
    return NextResponse.json({
      ok: true,
      results: [],
      message: "Arama yapmak için bir kelime girin.",
    });
  }

  const results = await searchBusinessContent(auth.session.businessId, query);
  return NextResponse.json({ ok: true, results });
}
