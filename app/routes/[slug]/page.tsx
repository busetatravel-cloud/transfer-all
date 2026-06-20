import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaFrame, PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { getLocalizedPublicSiteDataFromRequest } from "@/lib/public-site";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    return { title: "Rota detayi", description: "" };
  }

  const route = site.panel.routes.find((item) => (item.slug || item.id) === slug);

  if (!route) {
    return { title: "Rota detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: `/routes/${slug}`,
    title: route.title,
    description: route.description,
  });
}

export default async function RouteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { slug } = await params;
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    notFound();
  }

  const route = site.panel.routes.find((item) => (item.slug || item.id) === slug);

  if (!route) {
    notFound();
  }

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath={`/routes/${slug}`}
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Rota detay"
        title={route.title}
        description={route.description}
      >
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "route_cover",
              `${route.title} kapak gÃ¶rseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "route_cover")}
            label="Rota kapak gÃ¶rseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu rota yalnizca {site.panel.business.name} icerigiyle sinirlidir.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
