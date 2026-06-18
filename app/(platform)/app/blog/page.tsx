import { BusinessPanelModulePage } from "@/components/business-panel-module-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function BlogPage() {
  return BusinessPanelModulePage({ module: "blog" });
}
