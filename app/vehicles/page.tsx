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
    return { title: "Araclar", description: "Arac listesi." };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/vehicles",
    title: `${panel.business.name} | Araclar`,
    description: panel.seo.metaDescription || "Business arac listesi",
  });
}

export default async function VehiclesPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Araclar"
        title="Business arac listesi"
        description="Arac kayitlari ayni domain ve ayni businessId ile gösterilir."
      >
        {panel.vehicles.length ? (
          <CardGrid>
            {panel.vehicles.map((item) => (
              <ContentCard
                key={item.id}
                href={`/vehicles/${item.slug || item.id}`}
                title={item.title}
                description={item.description}
                imageAlt={item.title}
                imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_cover")}
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
