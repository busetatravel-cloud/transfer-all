import { PricingRulesModule } from "@/components/pricing-rules-module";
import { requireRole } from "@/lib/auth";
import { loadSuperAdminBusinesses } from "@/lib/business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminPricingRulesPage() {
  await requireRole("SUPER_ADMIN");
  const businessLoad = await loadSuperAdminBusinesses();

  return (
    <PricingRulesModule
      scope="super-admin"
      businessOptions={businessLoad.businesses.map((business) => ({
        id: business.id,
        name: business.name,
      }))}
    />
  );
}
