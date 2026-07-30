import { requireBusinessSession } from "@/lib/auth";
import { getBusinessThemeSettings } from "@/lib/theme-settings";
import { THEME_REGISTRY_ENTRIES } from "@/lib/theme-registry";
import { ThemeSettingsModule } from "@/components/theme-settings-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ThemePage() {
  const session = await requireBusinessSession();
  const currentSettings = await getBusinessThemeSettings(session.businessId);

  return (
    <ThemeSettingsModule
      entries={THEME_REGISTRY_ENTRIES}
      selectedTemplateKey={currentSettings.templateKey}
    />
  );
}
