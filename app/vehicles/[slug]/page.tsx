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
    return { title: "Arac detayi", description: "" };
  }

  const vehicle = panel.vehicles.find((item) => (item.slug || item.id) === slug);

  if (!vehicle) {
    return { title: "Arac detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: `/vehicles/${slug}`,
    title: vehicle.title,
    description: vehicle.description,
  });
}

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

  const vehicle = panel.vehicles.find((item) => (item.slug || item.id) === slug);

  if (!vehicle) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Arac detay"
        title={vehicle.title}
        description={vehicle.description}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_cover",
              `${vehicle.title} kapak görseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_cover")}
            label="Kapak"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_interior",
              `${vehicle.title} iç görünüm`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_interior")}
            label="İç görünüm"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_exterior",
              `${vehicle.title} dış görünüm`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_exterior")}
            label="Dış görünüm"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_trunk",
              `${vehicle.title} bagaj`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_trunk")}
            label="Bagaj"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_seat",
              `${vehicle.title} koltuk`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_seat")}
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
