import { notFound } from "next/navigation";
import {
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

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
        description={post.excerpt || "Blog yazısı"}
      >
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm leading-7 text-slate-600 shadow-sm">
          <p>{post.content || post.excerpt || "İçerik hazırlanıyor."}</p>
        </div>
      </PanelSection>
    </PublicSiteShell>
  );
}
