import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    return { title: "Teklif al", description: "Teklif formu." };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/quote",
    title: `${panel.business.name} | Teklif al`,
    description: panel.seo.metaDescription || "Business teklif formu",
  });
}

export default async function QuotePage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <PanelSection
        eyebrow="Teklif al"
        title="Basit teklif talebi"
        description="Form gonderimi temel requests tablosuna businessId ile yazilir."
      >
        <PublicQuoteForm businessId={panel.business.id} />
      </PanelSection>
    </PublicSiteShell>
  );
}
