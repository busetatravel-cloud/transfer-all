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
    return { title: "Blog detayi", description: "" };
  }

  const post = panel.blogs.find((item) => (item.slug || item.id) === slug);

  if (!post) {
    return { title: "Blog detayi", description: "" };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: `/blog/${slug}`,
    title: post.title,
    description: post.excerpt || post.content || "",
  });
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const panel = await getPublicSiteDataFromRequest();
  const { slug } = await params;

  if (!panel?.business) {
    notFound();
  }

  const post = panel.blogs.find((item) => (item.slug || item.id) === slug);

  if (!post) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
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
              `${post.title} kapak görseli`,
            )}
            imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "blog_cover")}
            label="Blog kapak görseli"
          />
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
            <p>{post.content || post.excerpt || "Icerik hazirlaniyor."}</p>
          </div>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
