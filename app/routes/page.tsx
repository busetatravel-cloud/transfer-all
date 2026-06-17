import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

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
        description="Rota verisi aynı businessId ile public domaine bağlanır."
      >
        <CardGrid>
          {panel.routes.map((item) => (
            <ContentCard
              key={item.id}
              href={`/routes/${item.slug || item.id}`}
              title={item.title}
              description={item.description}
            />
          ))}
        </CardGrid>
      </PanelSection>
    </PublicSiteShell>
  );
}
