import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  EmptyState,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";
import { resolveBusinessMediaSourceUrl } from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    return { title: "Rotalar", description: "Rota listesi." };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/routes",
    title: `${panel.business.name} | Rotalar`,
    description: panel.seo.metaDescription || "Business rota listesi",
  });
}

export default async function RoutesPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Rotalar"
        title="Business rota listesi"
        description="Rota verisi ayni businessId ile public domaine baglanir."
      >
        {panel.routes.length ? (
          <CardGrid>
            {panel.routes.map((item) => (
              <ContentCard
                key={item.id}
                href={`/routes/${item.slug || item.id}`}
                title={item.title}
                description={item.description}
                imageAlt={item.title}
                imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "route_cover")}
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
    </PublicSiteShell>
  );
}
