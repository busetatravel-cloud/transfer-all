import { notFound } from "next/navigation";
import { PanelSection, PublicSiteShell } from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getPublicSiteDataFromRequest } from "@/lib/public-site";

export default async function ContactPage() {
  const panel = await getPublicSiteDataFromRequest();

  if (!panel?.business) {
    notFound();
  }

  return (
    <PublicSiteShell business={panel.business}>
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PanelSection
          eyebrow="İletişim"
          title="Business iletişim kanalları"
          description="İletişim bilgileri doğrudan business kaydından okunur."
        >
          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <InfoRow label="Email" value={panel.business.email} />
            <InfoRow label="Telefon" value={panel.business.phone ?? "-"} />
            <InfoRow label="WhatsApp" value={panel.business.whatsapp ?? "-"} />
          </div>
        </PanelSection>

        <PanelSection
          eyebrow="Teklif formu"
          title="Kısa iletişim formu"
          description="Gönderilen talepler requests tablosuna businessId ile kaydedilir."
        >
          <PublicQuoteForm />
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
