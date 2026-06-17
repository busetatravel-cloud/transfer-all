import { notFound } from "next/navigation";
import {
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const panel = await getPublicSiteDataFromRequest();
  const { slug } = await params;

  if (!panel?.business) {
    notFound();
  }

  const vehicle = panel.vehicles.find(
    (item) => (item.slug || item.id) === slug,
  );

  if (!vehicle) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Araç detay"
        title={vehicle.title}
        description={vehicle.description}
      >
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
          Bu araç kaydı business sınırları içinde tutulur.
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
