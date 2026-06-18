import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  EmptyState,
  MediaFrame,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getSession } from "@/lib/auth";
import { getPublicSiteDataByHost } from "@/lib/public-site";
import { getLandingPath, isPlatformHost, normalizeHost } from "@/lib/platform";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = normalizeHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  const panel = await getPublicSiteDataByHost(host);

  if (!panel?.business) {
    return {
      title: "Transfer SaaS",
      description: "Custom domain destekli transfer platformu.",
    };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/",
    title: panel.seo.metaTitle || panel.business.name,
    description: panel.seo.metaDescription || panel.profile.heroSubtitle || "",
  });
}

export default async function HomePage() {
  const headerStore = await headers();
  const host = normalizeHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  if (isPlatformHost(host)) {
    const session = await getSession();
    redirect(getLandingPath(session?.role ?? null));
  }

  const panel = await getPublicSiteDataByHost(host);

  if (!panel?.business) {
    notFound();
  }

  const business = panel.business;

  return (
    <PublicSiteShell business={business}>
      <section className="grid gap-8">
        <div className="grid gap-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
          <div className="grid content-start gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {business.domain ?? "Custom domain"}
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-6xl">
              {panel.profile.heroTitle || business.name}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              {panel.profile.heroSubtitle ||
                "Business icin ozel public site. Menuler ve icerikler ayni domain icinde kalir."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                href="/quote"
              >
                {panel.profile.heroButtonText || "Teklif al"}
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                href="/contact"
              >
                Iletisim
              </Link>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <MediaFrame
              imageAlt={resolveBusinessMediaAltText(
                panel.mediaAssets,
                "hero",
                `${business.name} kapak görseli`,
              )}
              imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "hero")}
              label="Ana görsel"
            />
            <InfoRow label="Business email" value={business.email} />
            <InfoRow label="Telefon" value={business.phone ?? "-"} />
            <InfoRow label="WhatsApp" value={business.whatsapp ?? "-"} />
            <InfoRow label="Logo URL" value={business.logoUrl ?? "Empty"} />
          </div>
        </div>

        <PanelSection
          eyebrow="Hizmetler"
          title="Temel transfer hizmetleri"
          description="Business panelde tanimlanan icerikler public sitede ayni businessId ile izole edilir."
        >
          {panel.services.length ? (
            <CardGrid>
              {panel.services.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={`/services/${item.slug || item.id}`}
                  title={item.title}
                  description={item.description}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "service_cover")}
                />
              ))}
            </CardGrid>
          ) : (
            <EmptyState
              title="Hizmet yok"
              description="Bu business icin henuz hizmet kaydi girilmedi."
            />
          )}
        </PanelSection>

        <PanelSection eyebrow="Araclar" title="Arac secenekleri">
          {panel.vehicles.length ? (
            <CardGrid>
              {panel.vehicles.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={`/vehicles/${item.slug || item.id}`}
                  title={item.title}
                  description={item.description}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_cover")}
                />
              ))}
            </CardGrid>
          ) : (
            <EmptyState
              title="Arac yok"
              description="Bu business icin henuz arac kaydi girilmedi."
            />
          )}
        </PanelSection>

        <PanelSection eyebrow="Rotalar" title="Populer rotalar">
          {panel.routes.length ? (
            <CardGrid>
              {panel.routes.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={`/routes/${item.slug || item.id}`}
                  title={item.title}
                  description={item.description}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "route_cover")}
                />
              ))}
            </CardGrid>
          ) : (
            <EmptyState
              title="Rota yok"
              description="Bu business icin henuz rota kaydi girilmedi."
            />
          )}
        </PanelSection>

        <PanelSection eyebrow="Blog" title="Son yazilar">
          {panel.blogs.length ? (
            <CardGrid>
              {panel.blogs.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={`/blog/${item.slug || item.id}`}
                  title={item.title}
                  description={item.excerpt || item.content || "Blog yazisi"}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "blog_cover")}
                />
              ))}
            </CardGrid>
          ) : (
            <EmptyState
              title="Blog yok"
              description="Bu business icin henuz blog yazisi girilmedi."
            />
          )}
        </PanelSection>
      </section>
    </PublicSiteShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] truncate font-medium text-slate-900">{value}</span>
    </div>
  );
}
