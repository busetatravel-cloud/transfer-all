import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  EmptyState,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getLocalizedPublicSiteDataFromRequest } from "@/lib/public-site";
import { resolveBusinessMediaSourceUrl } from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    return { title: "Araclar", description: "Arac listesi." };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/vehicles",
    title: `${site.panel.business.name} | Araclar`,
    description: site.panel.seo.metaDescription || "Business arac listesi",
  });
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    notFound();
  }

  const withLocale = (href: string) => `${href}${href.includes("?") ? "&" : "?"}lang=${site.locale}`;

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath="/vehicles"
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Araclar"
        title="Business arac listesi"
        description="Arac kayitlari ayni businessId ile public sitede gösterilir."
      >
        {site.panel.vehicles.length ? (
          <CardGrid>
            {site.panel.vehicles.map((item) => (
              <ContentCard
                key={item.id}
                href={withLocale(`/vehicles/${item.slug || item.id}`)}
                title={item.title}
                description={item.description}
                imageAlt={item.title}
                imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_cover")}
              />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            title="Arac yok"
            description="Bu business icin henuz arac kaydi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}
