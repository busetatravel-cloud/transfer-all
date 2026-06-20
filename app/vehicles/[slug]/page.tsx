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
    return { title: "Arac detayi", description: "" };
  }

  const vehicle = site.panel.vehicles.find((item) => (item.slug || item.id) === slug);

  if (!vehicle) {
    return { title: "Arac detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: `/vehicles/${slug}`,
    title: vehicle.title,
    description: vehicle.description,
  });
}

export default async function VehicleDetailPage({
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

  const vehicle = site.panel.vehicles.find((item) => (item.slug || item.id) === slug);

  if (!vehicle) {
    notFound();
  }

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath={`/vehicles/${slug}`}
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Arac detay"
        title={vehicle.title}
        description={vehicle.description}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "vehicle_cover",
              `${vehicle.title} kapak gÃ¶rseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_cover")}
            label="Kapak"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "vehicle_interior",
              `${vehicle.title} iÃ§ gÃ¶rÃ¼nÃ¼m`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_interior")}
            label="Ä°Ã§ gÃ¶rÃ¼nÃ¼m"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "vehicle_exterior",
              `${vehicle.title} dÄ±ÅŸ gÃ¶rÃ¼nÃ¼m`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_exterior")}
            label="DÄ±ÅŸ gÃ¶rÃ¼nÃ¼m"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "vehicle_trunk",
              `${vehicle.title} bagaj`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_trunk")}
            label="Bagaj"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "vehicle_seat",
              `${vehicle.title} koltuk`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_seat")}
            label="Koltuk"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu arac kaydi business sinirlari icinde tutulur.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
