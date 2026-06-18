import { BusinessPanelModulePage } from "@/components/business-panel-module-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LanguagesPage() {
  return BusinessPanelModulePage({ module: "languages" });
}
