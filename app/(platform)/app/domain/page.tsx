import { DomainCenter } from "@/components/domain-center";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";
import { hasVercelDomainAutomation } from "@/lib/domain-provider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DomainPage() {
  const session = await requireBusinessSession();
  const business = await getBusinessById(session.businessId);

  if (!business) {
    return (
      <section className="grid min-h-[40vh] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Domain kaydı bulunamadı.
      </section>
    );
  }

  return <DomainCenter business={business} vercelConnectionReady={hasVercelDomainAutomation()} />;
}
