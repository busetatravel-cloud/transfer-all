import { requireRole } from "@/lib/auth";
import { listBusinesses } from "@/lib/business";
import { listPlans } from "@/lib/plans";
import { PlansModule } from "@/components/plans-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlansPage() {
  await requireRole("SUPER_ADMIN");
  const [plans, businesses] = await Promise.all([listPlans(), listBusinesses()]);

  return <PlansModule initialPlans={plans} initialBusinesses={businesses} />;
}
