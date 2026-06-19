import { requireRole } from "@/lib/auth";
import { listAuditLogs } from "@/lib/audit";
import { AuditModule } from "@/components/audit-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SuperAdminAuditPage() {
  await requireRole("SUPER_ADMIN");
  const logs = await listAuditLogs(null, 300);
  return <AuditModule scope="super-admin" logs={logs} />;
}

