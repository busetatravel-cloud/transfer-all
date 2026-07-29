import { requireRole } from "@/lib/auth";
import { getOperationsBoardDataWithLookup } from "@/lib/operations";
import { OperationsModule } from "@/components/operations-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function SuperAdminOperationsPage() {
  await requireRole("SUPER_ADMIN");
  const board = await getOperationsBoardDataWithLookup();

  return <OperationsModule scope="super-admin" businessName="All tenants" initialData={board} />;
}

