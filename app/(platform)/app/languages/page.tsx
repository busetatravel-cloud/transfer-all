import { LanguagesCenter } from "@/components/languages-center";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessPanelData } from "@/lib/business-panel";
import { readBusinessTranslationDrafts } from "@/lib/content-translations";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LanguagesPage() {
  const session = await requireBusinessSession();
  const panel = await getBusinessPanelData(session.businessId);
  const drafts = await readBusinessTranslationDrafts(session.businessId);

  if (!panel.business) {
    return (
      <section className="grid min-h-[40vh] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Business verisi bulunamadı.
      </section>
    );
  }

  return <LanguagesCenter businessId={session.businessId} panel={panel} drafts={drafts} />;
}

