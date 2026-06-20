import { NextResponse } from "next/server";
import { isPlatformHost, normalizeHost } from "@/lib/platform";

export async function GET(request: Request) {
  const nextRequest = request as Request & {
    nextUrl?: URL;
    headers: Headers;
  };
  const host = normalizeHost(
    nextRequest.headers.get("x-forwarded-host") ??
      nextRequest.headers.get("host") ??
      nextRequest.nextUrl?.hostname ??
      null,
  );
  const pathname = nextRequest.nextUrl?.pathname ?? new URL(request.url).pathname;
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
  });
}
