import { SuperAdminDomainsModule } from "@/components/super-admin-domains-module";
import { requireRole } from "@/lib/auth";
import { listBusinesses } from "@/lib/business";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminDomainsPage() {
  await requireRole("SUPER_ADMIN");
  const businesses = await listBusinesses();

  return <SuperAdminDomainsModule businesses={businesses} />;
}
