import { getTemplateDefinition } from "@/lib/builder/template-registry";
import type { BuilderTemplate, BuilderTemplatePageSeed } from "@/lib/builder/types";
import { getThemeRegistryEntry, type ThemeRegistryEntry } from "@/lib/theme-registry";

// ============================================================
// Preview Renderer — saf çözümleme katmanı (Faz 5).
//
// Bu dosya HİÇBİR React/JSX içermez — yalnızca "hangi template, hangi
// theme, hangi sayfa" sorusunu çözer. Render sorumluluğu tamamen
// components/builder/*.tsx katmanındadır (tek sorumluluk ilkesi).
// ============================================================

export interface ResolvedTemplatePreview {
  template: BuilderTemplate;
  themeEntry: ThemeRegistryEntry;
  page: BuilderTemplatePageSeed;
}

export type TemplateResolutionError =
  | { type: "template_not_found"; templateKey: string }
  | { type: "page_not_found"; templateKey: string; pageKey: string };

export function isTemplateResolutionError(
  value: ResolvedTemplatePreview | TemplateResolutionError,
): value is TemplateResolutionError {
  return "type" in value;
}

// "Sessizce yanlış template render etme" ilkesi gereği: bilinmeyen bir
// template/page key'i ASLA başka bir template'e (ör. varsayılan Modern
// Transfer'e) sessizce düşürülmez — açık bir hata sonucu döner, render
// katmanı bunu görünür bir uyarı olarak göstermek ZORUNDADIR.
export function resolveTemplatePreview(
  templateKey: string,
  pageKey: string = "home",
): ResolvedTemplatePreview | TemplateResolutionError {
  const template = getTemplateDefinition(templateKey);

  if (!template) {
    return { type: "template_not_found", templateKey };
  }

  const page = template.pages.find((candidate) => candidate.pageKey === pageKey);

  if (!page) {
    return { type: "page_not_found", templateKey, pageKey };
  }

  // Template Registry, kayıt anında themeKey'in Theme Registry'de var
  // olduğunu zaten doğruladı (bkz. lib/builder/template-registry.ts) — bu
  // çağrı yalnızca savunma amaçlıdır (defense in depth), getThemeRegistryEntry
  // kendi başına da güvenli varsayılana düşer.
  const themeEntry = getThemeRegistryEntry(template.themeKey);

  return { template, themeEntry, page };
}
