import "server-only";

import type { Metadata } from "next";
import type { BusinessRecord } from "@/lib/business";
import type { BusinessLocaleRecord, BusinessSeoRecord } from "@/lib/business-panel";
import { isReservedPlatformDomain, normalizeDomain } from "@/lib/platform";

export type SeoHreflangLink = {
  href: string;
  hrefLang: string;
};

function resolveBaseDomain(business: BusinessRecord, seo: BusinessSeoRecord) {
  const canonicalDomain = normalizeDomain(seo.canonicalUrl);
  const businessDomain = normalizeDomain(business.domain);

  if (canonicalDomain && !isReservedPlatformDomain(canonicalDomain)) {
    return canonicalDomain;
  }

  if (businessDomain && !isReservedPlatformDomain(businessDomain)) {
    return businessDomain;
  }

  return "";
}

export function buildCanonicalUrl(
  business: BusinessRecord,
  seo: BusinessSeoRecord,
  pathname: string,
) {
  const baseDomain = resolveBaseDomain(business, seo);

  if (!baseDomain) {
    return "";
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `https://${baseDomain}${normalizedPath}`;
}

export function buildHreflangLinks(
  business: BusinessRecord,
  seo: BusinessSeoRecord,
  locales: BusinessLocaleRecord[],
  pathname: string,
) {
  if (!seo.hreflangEnabled) {
    return [];
  }

  const baseDomain = resolveBaseDomain(business, seo);

  if (!baseDomain) {
    return [];
  }

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const activeLocales = locales.filter((locale) => locale.active && locale.published);

  if (!activeLocales.length) {
    return [
      {
        href: `https://${baseDomain}${normalizedPath}`,
        hrefLang: seo.defaultLocale || "x-default",
      },
    ];
  }

  return activeLocales.map((locale) => ({
    href: `https://${baseDomain}${normalizedPath}`,
    hrefLang: locale.code || seo.defaultLocale || "x-default",
  }));
}

export function buildBusinessSeoMetadata({
  business,
  seo,
  locales,
  pathname,
  title,
  description,
}: {
  business: BusinessRecord;
  seo: BusinessSeoRecord;
  locales: BusinessLocaleRecord[];
  pathname: string;
  title: string;
  description: string;
}): Metadata {
  const canonical = buildCanonicalUrl(business, seo, pathname);
  const hreflangLinks = buildHreflangLinks(business, seo, locales, pathname);

  return {
    title,
    description,
    alternates: {
      canonical: canonical || undefined,
      languages: hreflangLinks.length
        ? Object.fromEntries(
            hreflangLinks.map((link) => [link.hrefLang, link.href]),
          )
        : undefined,
    },
  };
}
