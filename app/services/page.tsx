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
    return { title: "Hizmetler", description: "Hizmet listesi." };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/services",
    title: `${panel.business.name} | Hizmetler`,
    description: panel.seo.metaDescription || "Business hizmet listesi",
  });
}

export default async function ServicesPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Hizmetler"
        title="Business hizmet listesi"
        description="Ayni businessId icindeki hizmetler public sitede listelenir."
      >
        {panel.services.length ? (
          <CardGrid>
            {panel.services.map((item) => (
              <ContentCard
                key={item.id}
                href={`/services/${item.slug || item.id}`}
                title={item.title}
                description={item.description}
                imageAlt={item.title}
                imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "service_cover")}
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
