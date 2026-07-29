import { PricingRulesModule } from "@/components/pricing-rules-module";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PricingRulesPage() {
  const session = await requireBusinessSession();
  const business = await getBusinessById(session.businessId);

  if (!business) {
    return (
      <section className="grid min-h-[40vh] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Business verisi bulunamadi.
      </section>
    );
  }

  return (
    <PricingRulesModule
      scope="business"
      businessId={business.id}
      businessName={business.name}
    />
  );
}
