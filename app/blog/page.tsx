import { notFound } from "next/navigation";
import {
  CardGrid,
  ContentCard,
  PanelSection,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

export default async function BlogPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Blog"
        title="Business yazıları"
        description="Blog içerikleri de aynı businessId ile izole edilir."
      >
        <CardGrid>
          {panel.blogs.map((item) => (
            <ContentCard
              key={item.id}
              href={`/blog/${item.slug || item.id}`}
              title={item.title}
              description={item.excerpt || item.content || "Blog yazısı"}
            />
          ))}
        </CardGrid>
      </PanelSection>
    </PublicSiteShell>
  );
}
