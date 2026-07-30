import type { ThemeSettings, ThemeTemplateKey } from "@/lib/theme-types";

export type ThemeRegistryEntry = {
  key: ThemeTemplateKey;
  label: string;
  description: string;
  settings: ThemeSettings;
};

export const DEFAULT_THEME_KEY: ThemeTemplateKey = "modern";

// Yeni bir tema eklemek bu registry'ye yeni bir kayıt eklemekten ibarettir.
// Block Registry (Hero/Services/Vehicles/... varyantları) ileride bu kayıtlara
// bir "blocks" alanı olarak eklenecek; bu fazda tema ayarları + (app/globals.css'teki
// [data-ps-theme="..."] seçicileri üzerinden) temaya özgü CSS taşınıyor.
//
// Nesneler donuk (frozen) tutulur: getThemeRegistryEntry() her çağrıda aynı referansı
// döndürdüğü için, çağıran kodun yanlışlıkla `settings.primaryColor = ...` gibi bir
// mutasyonla registry'nin tüm işletmeler için paylaşılan varsayılanını bozması engellenir.
export const THEME_REGISTRY: Record<ThemeTemplateKey, ThemeRegistryEntry> = {
  modern: Object.freeze({
    key: "modern",
    label: "Modern",
    description: "Mevcut varsayılan Transfer Turkey tasarımı. Açık tonlar, sade tipografi.",
    settings: Object.freeze({
      templateKey: "modern",
      primaryColor: "#0f172a",
      secondaryColor: "#f97316",
      backgroundColor: "#f8fafc",
      surfaceColor: "#ffffff",
      textColor: "#0f172a",
      borderRadius: "lg",
      shadow: "soft",
      fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      colorMode: "light",
    }),
  }),
  luxury: Object.freeze({
    key: "luxury",
    label: "Luxury",
    description:
      "Premium VIP transfer hissi veren koyu tonlu tema. Büyük hero alanı, altın vurgular, büyük kartlar.",
    settings: Object.freeze({
      templateKey: "luxury",
      primaryColor: "#f4d78b",
      secondaryColor: "#c9a227",
      backgroundColor: "#0b0d12",
      surfaceColor: "#15181f",
      textColor: "#f5f1e6",
      borderRadius: "sm",
      shadow: "strong",
      fontFamily: 'Georgia, "Times New Roman", Times, serif',
      colorMode: "dark",
    }),
  }),
};

export const THEME_REGISTRY_ENTRIES: ThemeRegistryEntry[] = Object.values(THEME_REGISTRY);

export function getThemeRegistryEntry(key: string | null | undefined): ThemeRegistryEntry {
  const normalized = (key ?? "") as ThemeTemplateKey;
  return THEME_REGISTRY[normalized] ?? THEME_REGISTRY[DEFAULT_THEME_KEY];
}
