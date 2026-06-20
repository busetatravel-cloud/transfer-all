import "server-only";

import { headers } from "next/headers";
import { getActiveBusinessByDomain, getBusinessById } from "@/lib/business";
import { getBusinessPanelData, type BusinessPanelData } from "@/lib/business-panel";
import {
  getPublishedBusinessPanelDataByBusinessId,
  ensureBusinessPublicationSeeded,
} from "@/lib/publishing";
import { getLocalizedPublicSiteData, type PublicSiteLocalization } from "@/lib/public-localization";
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

  await ensureBusinessPublicationSeeded(business.id);
  return getPublishedBusinessPanelDataByBusinessId(business.id);
}

export async function getPublicSiteDataFromRequest() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  return getPublicSiteDataByHost(host);
}

export async function getLocalizedPublicSiteDataFromRequest(
  requestedLocale?: string | null,
): Promise<PublicSiteLocalization | null> {
  const panel = await getPublicSiteDataFromRequest();
  return getLocalizedPublicSiteData(panel, requestedLocale);
}

export async function getPublicSiteDataByBusinessId(
  businessId: string,
): Promise<BusinessPanelData | null> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return null;
  }

  const business = await getBusinessById(safeBusinessId);

  if (!business) {
    return null;
  }

  const panel = await getBusinessPanelData(safeBusinessId);
  return panel.business ? panel : null;
}
