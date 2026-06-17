import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

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
        description="Aynı businessId içindeki hizmetler public sitede listelenir."
      >
        <CardGrid>
          {panel.services.map((item) => (
            <ContentCard
              key={item.id}
              href={`/services/${item.slug || item.id}`}
              title={item.title}
              description={item.description}
            />
          ))}
        </CardGrid>
      </PanelSection>
    </PublicSiteShell>
  );
}
