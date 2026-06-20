import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  EmptyState,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getLocalizedPublicSiteDataFromRequest } from "@/lib/public-site";
import { resolveBusinessMediaSourceUrl } from "@/lib/media";
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
    return { title: "Blog", description: "Blog listesi." };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/blog",
    title: `${site.panel.business.name} | Blog`,
    description: site.panel.seo.metaDescription || "Business blog listesi",
  });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    notFound();
  }

  const withLocale = (href: string) => `${href}${href.includes("?") ? "&" : "?"}lang=${site.locale}`;

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath="/blog"
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Blog"
        title="Business yazilari"
        description="Blog icerikleri de ayni businessId ile izole edilir."
      >
        {site.panel.blogs.length ? (
          <CardGrid>
            {site.panel.blogs.map((item) => (
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
            description="Bu business icin henuz blog yazisi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}
