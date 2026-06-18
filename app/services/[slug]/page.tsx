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
    return { title: "Hizmet detayi", description: "" };
  }

  const service = panel.services.find((item) => (item.slug || item.id) === slug);

  if (!service) {
    return { title: "Hizmet detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: `/services/${slug}`,
    title: service.title,
    description: service.description,
  });
}

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

  const service = panel.services.find((item) => (item.slug || item.id) === slug);

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
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "service_cover",
              `${service.title} kapak görseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "service_cover")}
            label="Hizmet kapak görseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu icerik sadece {panel.business.name} business kaydina aittir.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
