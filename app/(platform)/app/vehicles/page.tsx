import { BusinessPanelModulePage } from "@/components/business-panel-module-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function VehiclesPage() {
  return BusinessPanelModulePage({ module: "vehicles" });
}
