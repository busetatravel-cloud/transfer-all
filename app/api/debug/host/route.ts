import { NextResponse } from "next/server";
import { isPlatformHost, normalizeHost } from "@/lib/platform";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.hostname,
  );
  const pathname = url.pathname;
  const platformHost = isPlatformHost(host);

  console.info("/api/debug/host", {
    host,
    pathname,
    platformHost,
  });

  return NextResponse.json({
    host,
    pathname,
    isPlatformHost: platformHost,
    headers: Object.fromEntries(request.headers.entries()),
  });
}
