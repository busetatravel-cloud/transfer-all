import { requireBusinessSession } from "@/lib/auth";
import { getBusinessById } from "@/lib/business";
import { getOperationsBoardDataWithLookup } from "@/lib/operations";
import { OperationsModule } from "@/components/operations-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function OperationsPage() {
  const session = await requireBusinessSession();
  const [business, board] = await Promise.all([
    getBusinessById(session.businessId),
    getOperationsBoardDataWithLookup(session.businessId),
  ]);

  return (
    <OperationsModule
      scope="business"
      businessName={business?.name ?? "Business"}
      initialData={board}
    />
  );
}

