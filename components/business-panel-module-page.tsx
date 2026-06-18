import { BusinessPanelEditor } from "@/components/business-panel-editor";
import { requireBusinessSession } from "@/lib/auth";
import { getBusinessPanelData } from "@/lib/business-panel";

type ModulePageProps = {
  module:
    | "company"
    | "domain"
    | "media"
    | "services"
    | "vehicles"
    | "routes"
    | "blog"
    | "seo"
    | "languages"
    | "reservations"
    | "operation"
    | "finance"
    | "customers"
    | "password";
};

export async function BusinessPanelModulePage({ module }: ModulePageProps) {
  const session = await requireBusinessSession();
  const panel = await getBusinessPanelData(session.businessId);

  if (!panel.business) {
    return (
      <section className="grid min-h-[40vh] place-items-center rounded-[28px] border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
        Business verisi bulunamadi.
      </section>
    );
  }

  return <BusinessPanelEditor panel={panel} module={module} />;
}
