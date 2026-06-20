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
    return { title: "Hizmetler", description: "Hizmet listesi." };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/services",
    title: `${site.panel.business.name} | Hizmetler`,
    description: site.panel.seo.metaDescription || "Business hizmet listesi",
  });
}

export default async function ServicesPage({
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
      currentPath="/services"
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Hizmetler"
        title="Business hizmet listesi"
        description="Ayni businessId icindeki hizmetler public sitede listelenir."
      >
        {site.panel.services.length ? (
          <CardGrid>
            {site.panel.services.map((item) => (
              <ContentCard
                key={item.id}
                href={withLocale(`/services/${item.slug || item.id}`)}
                title={item.title}
                description={item.description}
                imageAlt={item.title}
                imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "service_cover")}
              />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            title="Hizmet yok"
            description="Bu business icin henuz hizmet kaydi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}
