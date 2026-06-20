import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getLandingPath, isStaticAssetPath } from "@/lib/platform";
import { isPlatformHost, normalizeHost } from "@/lib/platform";
import {
  getSessionSecret,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/session";

const PUBLIC_PATHS = [
  "/services",
  "/vehicles",
  "/routes",
  "/blog",
  "/contact",
  "/quote",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function redirectTo(pathname: string, request: NextRequest) {
  return NextResponse.redirect(new URL(pathname, request.url));
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = normalizeHost(
    request.headers.get("x-forwarded-host") ??
      request.headers.get("host") ??
      request.nextUrl.hostname,
  );
  const platformHost = isPlatformHost(host);
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-forwarded-host", host || request.nextUrl.hostname);
  forwardedHeaders.set("x-forwarded-proto", request.nextUrl.protocol.replace(":", ""));

  console.info("[proxy]", {
    host,
    pathname,
    platformHost,
  });

  if (isStaticAssetPath(pathname)) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  if (pathname.startsWith("/preview/")) {
    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  const session = verifySessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null,
    getSessionSecret(),
  );

  if (platformHost) {
    if (pathname === "/") {
      return redirectTo("/login", request);
    }

    if (isPublicPath(pathname)) {
      return redirectTo("/login", request);
    }

    if (pathname === "/login" && session) {
      return redirectTo(getLandingPath(session.role), request);
    }

    if (pathname.startsWith("/super-admin")) {
      if (!session) {
        return redirectTo("/login", request);
      }

      if (session.role !== "SUPER_ADMIN") {
        return redirectTo(getLandingPath(session.role), request);
      }
    }

    if (pathname.startsWith("/app")) {
      if (!session) {
        return redirectTo("/login", request);
      }

      if (session.role !== "BUSINESS_ADMIN") {
        return redirectTo(getLandingPath(session.role), request);
      }
    }

    return NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  if (
    pathname === "/login" ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/super-admin")
  ) {
    return redirectTo("/", request);
  }

  return NextResponse.next({ request: { headers: forwardedHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
