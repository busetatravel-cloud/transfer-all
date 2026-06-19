import { requireBusinessSession } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";
import { AuditModule } from "@/components/audit-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessAuditPage() {
  const session = await requireBusinessSession();
  const logs = await listAuditLogs(session.businessId, 200);
  return <AuditModule scope="business" logs={logs} />;
}

