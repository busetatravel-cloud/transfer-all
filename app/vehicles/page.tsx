import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

export default async function VehiclesPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Araçlar"
        title="Business araç listesi"
        description="Araç kayıtları aynı domain ve aynı businessId ile gösterilir."
      >
        <CardGrid>
          {panel.vehicles.map((item) => (
            <ContentCard
              key={item.id}
              href={`/vehicles/${item.slug || item.id}`}
              title={item.title}
              description={item.description}
            />
          ))}
        </CardGrid>
      </PanelSection>
    </PublicSiteShell>
  );
}
