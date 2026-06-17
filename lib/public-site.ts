import "server-only";

import { headers } from "next/headers";
import { getActiveBusinessByDomain } from "@/lib/business";
import { getBusinessPanelData, type BusinessPanelData } from "@/lib/business-panel";
import { isPlatformHost, normalizeHost } from "@/lib/platform";

export async function getPublicSiteDataByHost(
  host: string | null | undefined,
): Promise<BusinessPanelData | null> {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost || isPlatformHost(normalizedHost)) {
    return null;
  }

  const business = await getActiveBusinessByDomain(normalizedHost);

  if (!business) {
    return null;
  }

  return getBusinessPanelData(business.id);
}

export async function getPublicSiteDataFromRequest() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  return getPublicSiteDataByHost(host);
}
