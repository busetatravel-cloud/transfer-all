import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getLocalizedPublicSiteDataFromRequest } from "@/lib/public-site";
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
    return { title: "Teklif al", description: "Teklif formu." };
  }

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/quote",
    title: `${site.panel.business.name} | Teklif al`,
    description: site.panel.seo.metaDescription || "Business teklif formu",
  });
}

export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    notFound();
  }

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath="/quote"
      copy={site.copy}
    >
      <PanelSection
        eyebrow={site.copy.publicForm.title}
        title={site.copy.publicForm.title}
        description={site.copy.publicForm.description}
      >
        <PublicQuoteForm businessId={site.panel.business.id} copy={site.copy.publicForm} />
      </PanelSection>
    </PublicSiteShell>
  );
}
