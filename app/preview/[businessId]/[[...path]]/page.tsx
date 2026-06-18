import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  EmptyState,
  MediaFrame,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getPublicSiteDataByBusinessId } from "@/lib/public-site";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";
import { joinPublicPath } from "@/lib/public-path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PreviewParams = {
  businessId: string;
  path?: string[];
};

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function getBasePath(businessId: string) {
  return `/preview/${businessId}`;
}

async function loadPanel(businessId: string) {
  if (!isDevelopment()) {
    return null;
  }

  return getPublicSiteDataByBusinessId(businessId);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PreviewParams>;
}): Promise<Metadata> {
  const { businessId, path = [] } = await params;
  const panel = await loadPanel(businessId);

  if (!panel?.business) {
    return { title: "Preview", description: "" };
  }

  const [section, slug] = path;
  const pathname = resolvePreviewPath(getBasePath(businessId), section, slug);

  if (!section) {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: panel.seo.metaTitle || panel.business.name,
      description: panel.seo.metaDescription || panel.profile.heroSubtitle || "",
    });
  }

  if (section === "services" && !slug) {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: `${panel.business.name} | Hizmetler`,
      description: panel.seo.metaDescription || "Business hizmet listesi",
    });
  }

  if (section === "vehicles" && !slug) {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: `${panel.business.name} | Araçlar`,
      description: panel.seo.metaDescription || "Business araç listesi",
    });
  }

  if (section === "routes" && !slug) {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: `${panel.business.name} | Rotalar`,
      description: panel.seo.metaDescription || "Business rota listesi",
    });
  }

  if (section === "blog" && !slug) {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: `${panel.business.name} | Blog`,
      description: panel.seo.metaDescription || "Business blog listesi",
    });
  }

  if (section === "contact") {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: `${panel.business.name} | Iletisim`,
      description: panel.seo.metaDescription || "Business iletisim bilgileri",
    });
  }

  if (section === "quote") {
    return buildBusinessSeoMetadata({
      business: panel.business,
      seo: panel.seo,
      locales: panel.locales,
      pathname,
      title: `${panel.business.name} | Teklif al`,
      description: panel.seo.metaDescription || "Business teklif formu",
    });
  }

  return { title: "Preview", description: "" };
}

export default async function PreviewBusinessPage({
  params,
}: {
  params: Promise<PreviewParams>;
}) {
  const { businessId, path = [] } = await params;

  if (!isDevelopment()) {
    notFound();
  }

  const panel = await loadPanel(businessId);

  if (!panel?.business) {
    notFound();
  }

  const basePath = getBasePath(businessId);
  const [section, slug] = path;

  if (!section) {
    return <PreviewHome panel={panel} basePath={basePath} />;
  }

  if (section === "services" && !slug) {
    return <PreviewServices panel={panel} basePath={basePath} />;
  }

  if (section === "services" && slug) {
    return <PreviewServiceDetail panel={panel} basePath={basePath} slug={slug} />;
  }

  if (section === "vehicles" && !slug) {
    return <PreviewVehicles panel={panel} basePath={basePath} />;
  }

  if (section === "vehicles" && slug) {
    return <PreviewVehicleDetail panel={panel} basePath={basePath} slug={slug} />;
  }

  if (section === "routes" && !slug) {
    return <PreviewRoutes panel={panel} basePath={basePath} />;
  }

  if (section === "routes" && slug) {
    return <PreviewRouteDetail panel={panel} basePath={basePath} slug={slug} />;
  }

  if (section === "blog" && !slug) {
    return <PreviewBlog panel={panel} basePath={basePath} />;
  }

  if (section === "blog" && slug) {
    return <PreviewBlogDetail panel={panel} basePath={basePath} slug={slug} />;
  }

  if (section === "contact") {
    return <PreviewContact panel={panel} basePath={basePath} />;
  }

  if (section === "quote") {
    return <PreviewQuote panel={panel} basePath={basePath} />;
  }

  notFound();
}

function PreviewHome({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <section className="grid gap-8">
        <div className="grid gap-6 rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.15fr_0.85fr] lg:p-10">
          <div className="grid content-start gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {business.domain ?? "Preview"}
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 lg:text-6xl">
              {panel.profile.heroTitle || business.name}
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              {panel.profile.heroSubtitle ||
                "Business icin ozel public site. Menuler ve icerikler ayni domain icinde kalir."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                href={joinPublicPath(basePath, "/quote")}
              >
                {panel.profile.heroButtonText || "Teklif al"}
              </a>
              <a
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                href={joinPublicPath(basePath, "/contact")}
              >
                Iletisim
              </a>
            </div>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <MediaFrame
              imageAlt={resolveBusinessMediaAltText(
                panel.mediaAssets,
                "hero",
                `${business.name} kapak gorseli`,
              )}
              imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "hero")}
              label="Ana gorsel"
            />
            <InfoRow label="Business email" value={business.email} />
            <InfoRow label="Telefon" value={business.phone ?? "-"} />
            <InfoRow label="WhatsApp" value={business.whatsapp ?? "-"} />
            <InfoRow label="Logo URL" value={business.logoUrl ?? "Empty"} />
          </div>
        </div>

        <PreviewSection
          basePath={basePath}
          eyebrow="Hizmetler"
          title="Temel transfer hizmetleri"
          description="Business panelde tanimlanan icerikler preview businessId ile izole edilir."
          emptyTitle="Hizmet yok"
          emptyDescription="Bu business icin henuz hizmet kaydi girilmedi."
          items={panel.services}
          mediaAssets={panel.mediaAssets}
          kind="service_cover"
          hrefBase="/services"
        />

        <PreviewSection
          basePath={basePath}
          eyebrow="Araclar"
          title="Arac secenekleri"
          description="Arac listesi preview businessId ile izole edilir."
          emptyTitle="Arac yok"
          emptyDescription="Bu business icin henuz arac kaydi girilmedi."
          items={panel.vehicles}
          mediaAssets={panel.mediaAssets}
          kind="vehicle_cover"
          hrefBase="/vehicles"
        />

        <PreviewSection
          basePath={basePath}
          eyebrow="Rotalar"
          title="Populer rotalar"
          description="Rota listesi preview businessId ile izole edilir."
          emptyTitle="Rota yok"
          emptyDescription="Bu business icin henuz rota kaydi girilmedi."
          items={panel.routes}
          mediaAssets={panel.mediaAssets}
          kind="route_cover"
          hrefBase="/routes"
        />

        <PreviewSection
          basePath={basePath}
          eyebrow="Blog"
          title="Son yazilar"
          description="Blog icerikleri preview businessId ile izole edilir."
          emptyTitle="Blog yok"
          emptyDescription="Bu business icin henuz blog yazisi girilmedi."
          items={panel.blogs}
          mediaAssets={panel.mediaAssets}
          kind="blog_cover"
          hrefBase="/blog"
        />
      </section>
    </PublicSiteShell>
  );
}

function PreviewServices({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection
        eyebrow="Hizmetler"
        title="Business hizmet listesi"
        description="Ayni businessId icindeki hizmetler preview ortaminda listelenir."
      >
        {panel.services.length ? (
          <CardGrid>
            {panel.services.map((item) => (
              <ContentCard
                key={item.id}
                href={joinPublicPath(basePath, `/services/${item.slug || item.id}`)}
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
            description="Bu business icin henuz hizmet kaydi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewServiceDetail({
  panel,
  basePath,
  slug,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
  slug: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  const service = panel.services.find((item) => (item.slug || item.id) === slug);

  if (!service) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection eyebrow="Hizmet detay" title={service.title} description={service.description}>
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "service_cover",
              `${service.title} kapak gorseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "service_cover")}
            label="Hizmet kapak gorseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu icerik sadece {business.name} business kaydina aittir.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewVehicles({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection
        eyebrow="Araclar"
        title="Business arac listesi"
        description="Arac verisi ayni businessId ile preview icinde listelenir."
      >
        {panel.vehicles.length ? (
          <CardGrid>
            {panel.vehicles.map((item) => (
              <ContentCard
                key={item.id}
                href={joinPublicPath(basePath, `/vehicles/${item.slug || item.id}`)}
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
            description="Bu business icin henuz arac kaydi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewVehicleDetail({
  panel,
  basePath,
  slug,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
  slug: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  const vehicle = panel.vehicles.find((item) => (item.slug || item.id) === slug);

  if (!vehicle) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection eyebrow="Arac detay" title={vehicle.title} description={vehicle.description}>
        <div className="grid gap-4 lg:grid-cols-2">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_cover",
              `${vehicle.title} kapak gorseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_cover")}
            label="Kapak"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_interior",
              `${vehicle.title} ic gorunum`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_interior")}
            label="Ic gorunum"
          />
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "vehicle_exterior",
              `${vehicle.title} dis gorunum`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "vehicle_exterior")}
            label="Dis gorunum"
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

function PreviewRoutes({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection
        eyebrow="Rotalar"
        title="Business rota listesi"
        description="Rota verisi ayni businessId ile preview icinde listelenir."
      >
        {panel.routes.length ? (
          <CardGrid>
            {panel.routes.map((item) => (
              <ContentCard
                key={item.id}
                href={joinPublicPath(basePath, `/routes/${item.slug || item.id}`)}
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
            description="Bu business icin henuz rota kaydi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewRouteDetail({
  panel,
  basePath,
  slug,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
  slug: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  const route = panel.routes.find((item) => (item.slug || item.id) === slug);

  if (!route) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection eyebrow="Rota detay" title={route.title} description={route.description}>
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "route_cover",
              `${route.title} kapak gorseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "route_cover")}
            label="Rota kapak gorseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            Bu rota yalnizca {business.name} icerigiyle sinirlidir.
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewBlog({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection
        eyebrow="Blog"
        title="Business yazilari"
        description="Blog icerikleri de ayni businessId ile izole edilir."
      >
        {panel.blogs.length ? (
          <CardGrid>
            {panel.blogs.map((item) => (
              <ContentCard
                key={item.id}
                href={joinPublicPath(basePath, `/blog/${item.slug || item.id}`)}
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
            description="Bu business icin henuz blog yazisi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewBlogDetail({
  panel,
  basePath,
  slug,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
  slug: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  const post = panel.blogs.find((item) => (item.slug || item.id) === slug);

  if (!post) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection
        eyebrow="Blog detay"
        title={post.title}
        description={post.excerpt || "Blog yazisi"}
      >
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              panel.mediaAssets,
              "blog_cover",
              `${post.title} kapak gorseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "blog_cover")}
            label="Blog kapak gorseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            <p>{post.content || post.excerpt || "Icerik hazirlaniyor."}</p>
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewContact({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PanelSection
          eyebrow="Iletisim"
          title="Business iletisim kanallari"
          description="Iletisim bilgileri dogrudan business kaydindan okunur."
        >
          <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <MediaFrame
              imageAlt={resolveBusinessMediaAltText(
                panel.mediaAssets,
                "logo",
                `${business.name} logo`,
              )}
              imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "logo")}
              label="Logo"
            />
            <InfoRow label="Email" value={business.email} />
            <InfoRow label="Telefon" value={business.phone ?? "-"} />
            <InfoRow label="WhatsApp" value={business.whatsapp ?? "-"} />
          </div>
        </PanelSection>

        <PanelSection
          eyebrow="Teklif formu"
          title="Kisa iletisim formu"
          description="Gonderilen talepler requests tablosuna businessId ile kaydedilir."
        >
          <PublicQuoteForm businessId={business.id} previewBusinessId={business.id} />
        </PanelSection>
      </section>
    </PublicSiteShell>
  );
}

function PreviewQuote({
  panel,
  basePath,
}: {
  panel: NonNullable<Awaited<ReturnType<typeof loadPanel>>>;
  basePath: string;
}) {
  const business = panel.business;

  if (!business) {
    notFound();
  }

  return (
    <PublicSiteShell business={business} basePath={basePath}>
      <PanelSection
        eyebrow="Teklif al"
        title="Basit teklif talebi"
        description="Form gonderimi temel requests tablosuna businessId ile yazilir."
      >
        <PublicQuoteForm businessId={business.id} previewBusinessId={business.id} />
      </PanelSection>
    </PublicSiteShell>
  );
}

function PreviewSection<T extends { id: string; title: string; description?: string }>({
  basePath,
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  items,
  mediaAssets,
  kind,
  hrefBase,
}: {
  basePath: string;
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  items: Array<T & { slug?: string; excerpt?: string; content?: string }>;
  mediaAssets: NonNullable<Awaited<ReturnType<typeof loadPanel>>>["mediaAssets"];
  kind: "service_cover" | "vehicle_cover" | "route_cover" | "blog_cover";
  hrefBase: string;
}) {
  return (
    <PanelSection eyebrow={eyebrow} title={title} description={description}>
      {items.length ? (
        <CardGrid>
          {items.slice(0, 3).map((item) => (
            <ContentCard
              key={item.id}
              href={joinPublicPath(basePath, `${hrefBase}/${item.slug || item.id}`)}
              title={item.title}
              description={item.description || item.excerpt || item.content || "Icerik"}
              imageAlt={item.title}
              imageSrc={resolveBusinessMediaSourceUrl(mediaAssets, kind)}
            />
          ))}
        </CardGrid>
      ) : (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </PanelSection>
  );
}

function resolvePreviewPath(basePath: string, section?: string, slug?: string) {
  if (!section) {
    return basePath;
  }

  if (!slug) {
    return joinPublicPath(basePath, `/${section}`);
  }

  return joinPublicPath(basePath, `/${section}/${slug}`);
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] truncate font-medium text-slate-900">{value}</span>
    </div>
  );
}
