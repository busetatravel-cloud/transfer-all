import type { SessionRole } from "@/lib/session";

const PLATFORM_HOSTS = new Set([
  "busetatransfer.com",
  "www.busetatransfer.com",
  "localhost",
  "127.0.0.1",
]);

const STATIC_PATHS = [
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

export function normalizeHost(host: string | null | undefined) {
  return (host ?? "")
    .toLowerCase()
    .split(",")[0]
    .trim()
    .split(":")[0];
}

export function normalizeDomain(domain: string | null | undefined) {
  return (domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .split(":")[0];
}

export function isPlatformHost(host: string | null | undefined) {
  const normalized = normalizeHost(host);
  return PLATFORM_HOSTS.has(normalized);
}

export function isReservedPlatformDomain(domain: string | null | undefined) {
  const normalized = normalizeDomain(domain);
  return PLATFORM_HOSTS.has(normalized);
}

export function isStaticAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/") ||
    STATIC_PATHS.includes(pathname)
  );
}

export function getLandingPath(role: SessionRole | null) {
  if (role === "SUPER_ADMIN") {
    return "/super-admin";
  }

  if (role === "BUSINESS_ADMIN") {
    return "/app";
  }

  return "/login";
}
