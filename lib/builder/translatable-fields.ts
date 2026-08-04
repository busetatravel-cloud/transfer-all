// Website Builder Faz 13 — hangi block alanlarinin cevrilebilir oldugunun
// TEK kaynagi. Bilerek "server-only" DEGIL: hem server tarafi
// (lib/builder/translations.ts, save/apply validation icin) hem de admin
// builder'in "use client" inspector paneli (locale override formunu hangi
// alanlar icin gosterecegini bilmek icin) bu dosyayi import eder.
// Buradaki degerler DB'ye yazma/okuma icermez, saf veri sabitleridir.

import type { TranslationFieldKey } from "@/lib/translation-schema";

export const SECTION_TRANSLATABLE_FIELDS: Record<string, TranslationFieldKey[]> = {
  hero: ["eyebrow", "title", "subtitle", "primaryButtonText", "secondaryButtonText"],
  cta: ["title", "description", "primaryButtonText"],
  services_grid: ["eyebrow", "title", "description"],
};

export const PAGE_TRANSLATABLE_FIELDS: TranslationFieldKey[] = [
  "title",
  "description",
  "seoTitleHint",
  "seoDescriptionHint",
];

export function getTranslatableSectionFields(blockKey: string): readonly TranslationFieldKey[] {
  return SECTION_TRANSLATABLE_FIELDS[blockKey] ?? [];
}

export function getTranslatablePageFields(): readonly TranslationFieldKey[] {
  return PAGE_TRANSLATABLE_FIELDS;
}

export const BUILDER_FIELD_LABELS: Partial<Record<TranslationFieldKey, string>> = {
  eyebrow: "Üst etiket",
  title: "Başlık",
  subtitle: "Alt başlık",
  description: "Açıklama",
  primaryButtonText: "Birincil buton metni",
  secondaryButtonText: "İkincil buton metni",
  seoTitleHint: "SEO başlığı",
  seoDescriptionHint: "SEO açıklaması",
};
