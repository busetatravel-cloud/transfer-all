import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaFrame, PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const panel = await getPublicSiteDataFromRequest();
  const { slug } = await params;

  if (!panel?.business) {
    return { title: "Rota detayi", description: "" };
  }

  const route = panel.routes.find((item) => (item.slug || item.id) === slug);

  if (!route) {
    return { title: "Rota detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: `/routes/${slug}`,
    title: route.title,
    description: route.description,
  });
}

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
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "route_cover",
              `${route.title} kapak görseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "route_cover")}
            label="Rota kapak görseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu rota yalnizca {panel.business.name} icerigiyle sinirlidir.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
