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
import { resolveBuilderSeoHints, resolvePublishedBuilderPage } from "@/lib/builder/public-render";
import { PublicBuilderPageContent } from "@/components/builder/public-page-renderer";
import "@/lib/builder/blocks/index";

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
    return { title: "Rotalar", description: "Rota listesi." };
  }

  const builderPage = await resolvePublishedBuilderPage(site.panel.business.id, "routes");
  const builderSeo = resolveBuilderSeoHints(builderPage, site.panel.business.name);

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/routes",
    title: builderSeo.title || `${site.panel.business.name} | Rotalar`,
    description: builderSeo.description || site.panel.seo.metaDescription || "Business rota listesi",
  });
}

export default async function RoutesPage({
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
  const builderPage = await resolvePublishedBuilderPage(site.panel.business.id, "routes");

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath="/routes"
      copy={site.copy}
    >
      {builderPage ? (
        <PublicBuilderPageContent page={builderPage} panel={site.panel} locale={site.locale} />
      ) : (
      <PanelSection
        eyebrow="Rotalar"
        title="Business rota listesi"
        description="Rota verisi ayni businessId ile public domaine baglanir."
      >
        {site.panel.routes.length ? (
          <CardGrid>
            {site.panel.routes.map((item) => (
              <ContentCard
                key={item.id}
                href={withLocale(`/routes/${item.slug || item.id}`)}
                title={item.title}
                description={item.description}
                imageAlt={item.title}
                imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "route_cover")}
              />
            ))}
          </CardGrid>
        ) : (
          <EmptyState
            title="Rota yok"
            description="Bu business icin henuz rota kaydi bulunmuyor."
          />
        )}
      </PanelSection>
      )}
    </PublicSiteShell>
  );
}
