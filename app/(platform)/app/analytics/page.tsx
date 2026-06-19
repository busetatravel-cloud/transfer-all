import { AnalyticsModule } from "@/components/analytics-module";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessAnalyticsSummary } from "@/lib/analytics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsPage() {
  const session = await requireBusinessSession();
  const summary = await getBusinessAnalyticsSummary(session.businessId);

  return <AnalyticsModule summary={summary} recentEvents={summary.recentEvents} />;
}
