import { notFound } from "next/navigation";
import {
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const panel = await getPublicSiteDataFromRequest();
  const { slug } = await params;

  if (!panel?.business) {
    notFound();
  }

  const service = panel.services.find(
    (item) => (item.slug || item.id) === slug,
  );

  if (!service) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Hizmet detay"
        title={service.title}
        description={service.description}
      >
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
          Bu içerik sadece {panel.business.name} business kaydına aittir.
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
