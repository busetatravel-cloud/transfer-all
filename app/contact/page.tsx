import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MediaFrame, PanelSection, PhoneIcon, PublicSiteShell, WhatsAppIcon, toWhatsAppDigits } from "@/components/public-site-shell";
import { PublicQuoteForm } from "@/components/public-quote-form";
import { getLocalizedPublicSiteDataFromRequest } from "@/lib/public-site";
import {
  resolveBusinessMediaAltText,
  resolveBusinessMediaSourceUrl,
} from "@/lib/media";
import { buildBusinessSeoMetadata } from "@/lib/seo";
import {
  resolveBuilderPageSeoOverride,
  resolveBuilderSeoHints,
  resolvePublishedBuilderPage,
  resolvePublishedBuilderTranslations,
} from "@/lib/builder/public-render";
import { PublicBuilderPageContent } from "@/components/builder/public-page-renderer";
import "@/lib/builder/blocks/index";

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
    return { title: "Iletisim", description: "Iletisim sayfasi." };
  }

  const resolved = await resolvePublishedBuilderPage(site.panel.business.id, "contact");
  const seoOverride = resolved
    ? resolveBuilderPageSeoOverride(
        resolved.page,
        await resolvePublishedBuilderTranslations(site.panel.business.id, resolved.revisionId),
        site.locale,
        site.fallbackLocale,
      )
    : undefined;
  const builderSeo = resolveBuilderSeoHints(resolved?.page ?? null, site.panel.business.name, seoOverride);

  return buildBusinessSeoMetadata({
    business: site.panel.business,
    seo: site.panel.seo,
    locales: site.panel.locales,
    pathname: "/contact",
    title: builderSeo.title || `${site.panel.business.name} | Iletisim`,
    description: builderSeo.description || site.panel.seo.metaDescription || "Business iletisim bilgileri",
  });
}

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const site = await getLocalizedPublicSiteDataFromRequest(lang ?? null);

  if (!site?.panel.business) {
    notFound();
  }

  // Faz 13 — Contact sayfasi KISMI builder entegrasyonu: kritik teklif
  // formu (PublicQuoteForm) ve firma bilgi karti HER ZAMAN, degismeden,
  // asagida render edilir. Builder'da "contact" sayfasi yayinlanmissa,
  // yalnizca EK icerik (ör. Hero/CTA) formun UZERINDE gosterilir — form
  // hicbir zaman builder'a bagli/kosullu degildir, businessId/tenant
  // scope/validation/submission API'si bu degisiklikten etkilenmez.
  const resolvedContact = await resolvePublishedBuilderPage(site.panel.business.id, "contact");

  return (
    <PublicSiteShell
      business={site.panel.business}
      locale={site.locale}
      locales={site.availableLocales}
      currentPath="/contact"
      copy={site.copy}
    >
      {resolvedContact ? (
        <div className="mb-8">
          <PublicBuilderPageContent
            page={resolvedContact.page}
            panel={site.panel}
            locale={site.locale}
            fallbackLocale={site.fallbackLocale}
            revisionId={resolvedContact.revisionId}
          />
        </div>
      ) : null}
      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <PanelSection
          eyebrow={site.copy.menus.contact}
          title={site.copy.publicForm.title}
          description={site.copy.publicForm.description}
        >
          <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <MediaFrame
              imageAlt={resolveBusinessMediaAltText(
                site.panel.mediaAssets,
                "logo",
                `${site.panel.business.name} logo`,
              )}
              imageSrc={resolveBusinessMediaSourceUrl(site.panel.mediaAssets, "logo")}
              label="Logo"
            />
            <a className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm transition hover:border-slate-300 hover:bg-white" href={`mailto:${site.panel.business.email}`}>
              <span className="text-slate-500">Email</span>
              <span className="max-w-[60%] truncate font-medium text-slate-900">{site.panel.business.email}</span>
            </a>
            {site.panel.business.phone ? (
              <a className="ps-cta-phone justify-between" href={`tel:${site.panel.business.phone}`}>
                <span className="flex items-center gap-2"><PhoneIcon /> Telefon</span>
                <span>{site.panel.business.phone}</span>
              </a>
            ) : null}
            {site.panel.business.whatsapp ? (
              <a
                className="ps-cta-whatsapp justify-between"
                href={`https://wa.me/${toWhatsAppDigits(site.panel.business.whatsapp)}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span className="flex items-center gap-2"><WhatsAppIcon /> WhatsApp</span>
                <span>{site.panel.business.whatsapp}</span>
              </a>
            ) : null}
          </div>
        </PanelSection>

        <PanelSection
          eyebrow={site.copy.publicForm.title}
          title={site.copy.publicForm.title}
          description={site.copy.publicForm.description}
        >
          <PublicQuoteForm businessId={site.panel.business.id} copy={site.copy.publicForm} />
        </PanelSection>
      </section>
    </PublicSiteShell>
  );
}
