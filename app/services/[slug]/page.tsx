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
    return { title: "Hizmet detayi", description: "" };
  }

  const service = site.panel.services.find((item) => (item.slug || item.id) === slug);

  if (!service) {
    return { title: "Hizmet detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: `/services/${slug}`,
    title: service.title,
    description: service.description,
  });
}

export default async function ServiceDetailPage({
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

  const service = site.panel.services.find((item) => (item.slug || item.id) === slug);

  if (!service) {
    notFound();
  }

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath={`/services/${slug}`}
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Hizmet detay"
        title={service.title}
        description={service.description}
      >
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "service_cover",
              `${service.title} kapak gÃ¶rseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "service_cover")}
            label="Hizmet kapak gÃ¶rseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu icerik sadece {site.panel.business.name} business kaydina aittir.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
