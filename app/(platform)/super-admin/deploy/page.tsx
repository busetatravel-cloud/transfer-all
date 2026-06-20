import { requireRole } from "@/lib/auth";
import {
  getDeployChecklistItems,
  getDeployHealthCards,
  listDeployReleases,
} from "@/lib/deploy";
import { SuperAdminDeployModule } from "@/components/super-admin-deploy-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminDeployPage() {
  await requireRole("SUPER_ADMIN");
  const productionTarget = process.env.PUBLIC_DOMAIN_TARGET?.trim() || null;
  const [healthCards, releases, checklistItems] = await Promise.all([
    getDeployHealthCards(),
    listDeployReleases(100),
    getDeployChecklistItems(),
  ]);

  return (
    <SuperAdminDeployModule
      healthCards={healthCards}
      releases={releases}
      checklistItems={checklistItems}
      productionTarget={productionTarget}
    />
  );
}
