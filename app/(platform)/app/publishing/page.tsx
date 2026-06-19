import { PublishingCenter } from "@/components/publishing-center";
import { requireBusinessSession } from "@/lib/auth";
import { getPublishingCenterData } from "@/lib/publishing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PublishingPage() {
  const session = await requireBusinessSession();
  const data = await getPublishingCenterData(session.businessId);

  if (!data.business) {
    return (
      <section className="grid min-h-[40vh] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Yayın merkezi için business verisi bulunamadı.
      </section>
    );
  }

  return <PublishingCenter businessId={session.businessId} data={data} />;
}
