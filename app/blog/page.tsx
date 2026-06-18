import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  EmptyState,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";
import { resolveBusinessMediaSourceUrl } from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    return { title: "Blog", description: "Blog listesi." };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/blog",
    title: `${panel.business.name} | Blog`,
    description: panel.seo.metaDescription || "Business blog listesi",
  });
}

export default async function BlogPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
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
            description="Bu business icin henuz blog yazisi bulunmuyor."
          />
        )}
      </PanelSection>
    </PublicSiteShell>
  );
}
