import { requireBusinessSession } from "@/lib/auth";
import { buildExportPreview, listExportLogs } from "@/lib/export";
import { ExportModule } from "@/components/export-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ExportPageProps = {
  searchParams: Promise<{ type?: string }>;
};

export default async function ExportPage({ searchParams }: ExportPageProps) {
  const session = await requireBusinessSession();
  const { type } = await searchParams;
  const exportType =
    type === "customers" ||
    type === "tasks" ||
    type === "finance" ||
    type === "operation"
      ? type
      : "reservations";

  const [preview, logs] = await Promise.all([
    buildExportPreview(session.businessId, exportType),
    listExportLogs(session.businessId),
  ]);

  return (
    <ExportModule
      businessId={session.businessId}
      initialLogs={logs}
      initialPreview={preview}
      initialType={exportType}
    />
  );
}
