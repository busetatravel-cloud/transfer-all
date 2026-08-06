// Website Builder Faz 13 (genişletildi Faz 15) — hangi block alanlarinin
// cevrilebilir oldugunun TEK kaynagi. Bilerek "server-only" DEGIL: hem
// server tarafi (lib/builder/translations.ts, save/apply validation icin)
// hem de admin builder'in "use client" inspector paneli (locale override
// formunu hangi alanlar icin gosterecegini bilmek icin) bu dosyayi import
// eder. Buradaki degerler DB'ye yazma/okuma icermez, saf veri sabitleridir.
//
// Faz 15: duz (flat, section'in KENDI content'indeki) alanlarin yaninda,
// TEKRARLANAN OGE LISTESI (repeater) taşıyan bloklar icin de (Hero Slider'in
// slaytlari, FAQ'in sorulari, Testimonials'in yorumlari, Statistics'in
// istatistikleri, Trust Badges/Partners'in rozetleri, Contact Info'nun
// sosyal linkleri) cevrilebilir alan tanimi eklendi. Bir repeater ogesi,
// section'in KENDI sourceId'sinden AYRI, bilesik bir sourceId ile adreslenir:
// `${sectionId}:${itemId}` (bkz. lib/builder/translations.ts
// findBuilderSource). Alttaki business_content_translations/
// business_publication_translations tablolarinda sourceId zaten opak bir
// string oldugu icin (ör. "profile", "main" gibi section-disi degerler
// halihazirda kullaniliyor) bu, şema DEGISIKLIGI GEREKTIRMEZ.
//
// Vehicle Showcase / Routes Showcase Faz 15 kapsamina BILEREK DAHIL
// EDILMEDI (kullanicinin cevrilecek blok listesinde yoklar) — gercek veri
// zaten adaptorden geldigi icin yalnizca content metadata'lari (eyebrow/
// title/description) cevrilebilir olurdu, bu ileriki bir faza birakildi.

import type { TranslationFieldKey } from "@/lib/translation-schema";

export const SECTION_TRANSLATABLE_FIELDS: Record<string, TranslationFieldKey[]> = {
  hero: ["eyebrow", "title", "subtitle", "primaryButtonText", "secondaryButtonText"],
  cta: ["title", "description", "primaryButtonText"],
  services_grid: ["eyebrow", "title", "description"],
  // Faz 15 — Faz 14 bloklari.
  gallery: ["eyebrow", "title", "description", "emptyStateTitle", "emptyStateDescription"],
  faq: ["eyebrow", "title", "description"],
  testimonials: ["eyebrow", "title"],
  statistics: ["eyebrow", "title"],
  video: ["title", "description"],
  trust_badges: ["eyebrow", "title"],
  partners: ["eyebrow", "title"],
  booking_cta: ["title", "description", "primaryButtonText", "whatsappButtonText", "phoneButtonText"],
  contact_info: ["eyebrow", "title", "address", "hours"],
};

export type TranslatableRepeaterConfig = {
  arrayField: string;
  itemFields: TranslationFieldKey[];
};

export const SECTION_TRANSLATABLE_REPEATERS: Record<string, TranslatableRepeaterConfig[]> = {
  hero_slider: [{ arrayField: "slides", itemFields: ["title", "subtitle", "description", "primaryButtonText", "secondaryButtonText"] }],
  faq: [{ arrayField: "items", itemFields: ["question", "answer"] }],
  testimonials: [{ arrayField: "items", itemFields: ["quote"] }],
  statistics: [{ arrayField: "items", itemFields: ["label"] }],
  trust_badges: [{ arrayField: "items", itemFields: ["label", "altText"] }],
  partners: [{ arrayField: "items", itemFields: ["label", "altText"] }],
  contact_info: [{ arrayField: "socialLinks", itemFields: ["platform"] }],
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

export function getTranslatableRepeaters(blockKey: string): readonly TranslatableRepeaterConfig[] {
  return SECTION_TRANSLATABLE_REPEATERS[blockKey] ?? [];
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
  question: "Soru",
  answer: "Cevap",
  quote: "Yorum",
  label: "Etiket",
  altText: "Alt metin",
  address: "Adres",
  hours: "Çalışma saatleri",
  platform: "Platform",
  whatsappButtonText: "WhatsApp buton metni",
  phoneButtonText: "Telefon buton metni",
  emptyStateTitle: "Boş durum başlığı",
  emptyStateDescription: "Boş durum açıklaması",
};
