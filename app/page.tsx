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
import {
  getLocalizedPublicSiteDataFromRequest,
  getPublicSiteDataByHost,
} from "@/lib/public-site";
import { isPlatformHost, normalizeHost } from "@/lib/platform";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    return {
      title: "Transfer SaaS",
      description: "Custom domain destekli transfer platformu.",
    };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/",
    title: site.panel.seo.metaTitle || site.panel.business.name,
    description: site.panel.seo.metaDescription || site.panel.profile.heroSubtitle || "",
  });
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const headerStore = await headers();
  const host = normalizeHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  if (isPlatformHost(host)) {
    redirect("/login");
  }

  const panel = await getPublicSiteDataByHost(host);
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!panel?.business || !site?.panel.business) {
    notFound();
  }

  const business = site.panel.business;
  const withLocale = (href: string) => `${href}${href.includes("?") ? "&" : "?"}lang=${site.locale}`;

  return (
    <PublicSiteShell
      business={business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath="/"
      copy={site.copy}
    >
      <section className="grid gap-8">
        <div className="grid gap-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
          <div className="grid content-start gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {business.domain ?? "Custom domain"}
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-6xl">
              {site.panel.profile.heroTitle || business.name}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              {site.panel.profile.heroSubtitle ||
                "Business icin ozel public site. Menuler ve icerikler ayni domain icinde kalir."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                href={withLocale("/quote")}
              >
                {site.panel.profile.heroButtonText || "Teklif al"}
              </Link>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                href={withLocale("/contact")}
              >
                {site.copy.menus.contact}
              </Link>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <MediaFrame
              imageAlt={resolveBusinessMediaAltText(
                site.panel.mediaAssets,
                "hero",
                `${business.name} kapak gÃ¶rseli`,
              )}
              imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "hero")}
              label="Ana gÃ¶rsel"
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
          {site.panel.services.length ? (
            <CardGrid>
              {site.panel.services.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={withLocale(`/services/${item.slug || item.id}`)}
                  title={item.title}
                  description={item.description}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "service_cover")}
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
          {site.panel.vehicles.length ? (
            <CardGrid>
              {site.panel.vehicles.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={withLocale(`/vehicles/${item.slug || item.id}`)}
                  title={item.title}
                  description={item.description}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "vehicle_cover")}
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
          {site.panel.routes.length ? (
            <CardGrid>
              {site.panel.routes.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={withLocale(`/routes/${item.slug || item.id}`)}
                  title={item.title}
                  description={item.description}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "route_cover")}
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
          {site.panel.blogs.length ? (
            <CardGrid>
              {site.panel.blogs.slice(0, 3).map((item) => (
                <ContentCard
                  key={item.id}
                  href={withLocale(`/blog/${item.slug || item.id}`)}
                  title={item.title}
                  description={item.excerpt || item.content || "Blog yazisi"}
                  imageAlt={item.title}
                  imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "blog_cover")}
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
