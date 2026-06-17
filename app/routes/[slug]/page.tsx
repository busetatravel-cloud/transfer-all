import { notFound } from "next/navigation";
import {
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const panel = await getPublicSiteDataFromRequest();
  const { slug } = await params;

  if (!panel?.business) {
    notFound();
  }

  const route = panel.routes.find((item) => (item.slug || item.id) === slug);

  if (!route) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Rota detay"
        title={route.title}
        description={route.description}
      >
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
          Bu rota yalnızca {panel.business.name} içeriğiyle sınırlıdır.
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
