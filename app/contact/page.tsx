import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaFrame, PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    return { title: "Iletisim", description: "Iletisim sayfasi." };
  }

  return buildBusinessSeoMetadata({
    business: panel.business,
    seo: panel.seo,
    locales: panel.locales,
    pathname: "/contact",
    title: `${panel.business.name} | Iletisim`,
    description: panel.seo.metaDescription || "Business iletisim bilgileri",
  });
}

export default async function ContactPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
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
                `${panel.business.name} logo`,
              )}
              imageSrc={resolveBusinessMediaSourceUrl(panel.mediaAssets, "logo")}
              label="Logo"
            />
            <InfoRow label="Email" value={panel.business.email} />
            <InfoRow label="Telefon" value={panel.business.phone ?? "-"} />
            <InfoRow label="WhatsApp" value={panel.business.whatsapp ?? "-"} />
          </div>
        </PanelSection>

        <PanelSection
          eyebrow="Teklif formu"
          title="Kisa iletisim formu"
          description="Gonderilen talepler requests tablosuna businessId ile kaydedilir."
        >
          <PublicQuoteForm businessId={panel.business.id} />
        </PanelSection>
      </section>
    </PublicSiteShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="max-w-[60%] truncate font-medium text-slate-900">{value}</span>
    </div>
  );
}
