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
    return { title: "Blog detayi", description: "" };
  }

  const post = site.panel.blogs.find((item) => (item.slug || item.id) === slug);

  if (!post) {
    return { title: "Blog detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: `/blog/${slug}`,
    title: post.title,
    description: post.excerpt || post.content || "",
  });
}

export default async function BlogDetailPage({
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

  const post = site.panel.blogs.find((item) => (item.slug || item.id) === slug);

  if (!post) {
    notFound();
  }

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath={`/blog/${slug}`}
      copy={site.copy}
    >
      <PanelSection
        eyebrow="Blog detay"
        title={post.title}
        description={post.excerpt || "Blog yazisi"}
      >
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <MediaFrame
            imageAlt={resolveBusinessMediaAltText(
              site.panel.mediaAssets,
              "blog_cover",
              `${post.title} kapak gÃ¶rseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "blog_cover")}
            label="Blog kapak gÃ¶rseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            <p>{post.content || post.excerpt || "Icerik hazirlaniyor."}</p>
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
