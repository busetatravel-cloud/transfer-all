import { notFound } from "next/navigation";
import { PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

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
        description="Form gönderimi temel requests tablosuna businessId ile yazılır."
      >
        <PublicQuoteForm />
      </PanelSection>
    </PublicSiteShell>
  );
}
