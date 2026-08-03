import type { FunctionComponent } from "react";
import type { BreakpointToken } from "@/lib/design-system/tokens";
import type { ThemeColorModeToken, ThemeTemplateKey } from "@/lib/theme-types";

// ============================================================
// Website Builder — temel tipler (Faz 2).
//
// Bu dosya YALNIZCA tip tanımlarını içerir: hiçbir runtime davranışı,
// hiçbir DB erişimi, hiçbir React bileşeni yoktur. Henüz hiçbir tüketicisi
// olmadığı için mevcut hiçbir sayfayı/özelliği etkilemez.
//
// Kavram ayrımı (mimari analiz raporundaki "C" bölümüyle birebir eşleşir):
//   Theme     -> lib/theme-types.ts (mevcut, dokunulmadı)
//   Template  -> BuilderTemplate (yalnızca kod-içi seed kaynağı, DB'de değil)
//   Page      -> BuilderPage
//   Section   -> BuilderSection (bir Page'e yerleştirilmiş Block+Variant örneği)
//   Block     -> BlockDefinition (registry'deki TİP tanımı, Faz 3'te doldurulacak)
//   Variant   -> BlockVariantDefinition
//   Content   -> TContent (jenerik, blok bazlı)
//   Style     -> TStyle (jenerik, blok bazlı)
//   Responsive-> BuilderResponsiveOverrides<TContent, TStyle>
//   Draft     -> BuilderPage / BuilderSection'ın kendisi (ayrı bir taslak tipi YOK;
//                mevcut business_services/vehicles/routes deseniyle tutarlı: taslak,
//                canlı satırın kendisidir)
//   Published -> PublishedRecord<T> (mevcut lib/content-translations.ts'teki
//                PublishedTranslationRecord = TranslationDraftRecord & { revisionId }
//                deseninin birebir devamı)
// ============================================================

// ------------------------------------------------------------
// JSON-safe değer tipleri — content/style/responsive alanları Postgres
// jsonb kolonlarına yazılacağı için yalnızca JSON'a serileştirilebilir
// değerler taşıyabilir. `any` kullanılmaz; bilinmeyen veri `unknown` olarak
// tutulur ve yalnızca doğrulama (validate) sonrası daraltılır.
// ------------------------------------------------------------
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
export type JsonRecord = { [key: string]: JsonValue };

// ------------------------------------------------------------
// BlockKey / VariantKey — "brand" (nominal) tipler.
//
// Bilinçli olarak KAPALI bir union (örn. "hero" | "cta" | ...) DEĞİLDİR:
// bloklar onlarca/yüzlerce olacağı için her yeni blokta bu dosyayı
// güncellemek gerekmemeli (theme-types.ts'teki ThemeTemplateKey gibi kapalı
// bir union burada YANLIŞ tercih olurdu — temalar birkaç taneyken bloklar
// büyük bir kayıt defteri olacak). Bunun yerine düz string'in üzerine ince
// bir "brand" eklenir: normal bir string'i yanlışlıkla bir BlockKey yerine
// geçirmek derleme zamanında engellenir, ama runtime'da hâlâ sade bir
// string'tir (DB/JSON uyumluluğu sıfır ek maliyetle korunur). Geçerliliğin
// gerçek kaynağı Faz 3'teki Block Registry'dir (runtime'da doğrulanır).
declare const blockKeyBrand: unique symbol;
export type BlockKey = string & { readonly [blockKeyBrand]: true };

declare const variantKeyBrand: unique symbol;
export type VariantKey = string & { readonly [variantKeyBrand]: true };

export function asBlockKey(value: string): BlockKey {
  return value as BlockKey;
}

export function asVariantKey(value: string): VariantKey {
  return value as VariantKey;
}

// ------------------------------------------------------------
// Responsive — Faz 1'deki BREAKPOINTS (mobile/tablet/desktop) ile birebir
// aynı üç değeri kullanır; Live Preview iframe genişlikleri ile burada
// tanımlanan breakpoint'ler arasında ASLA sapma olmaz (tek kaynak).
// ------------------------------------------------------------
export interface BuilderBreakpointOverride<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
> {
  visible?: boolean;
  order?: number;
  content?: Partial<TContent>;
  style?: Partial<TStyle>;
}

// Yalnızca FARKLI olan alanlar saklanır (sparse override) — "veri modelinin
// aşırı karmaşıklaşmasını engelle" ilkesi gereği breakpoint başına tüm
// content/style'ın kopyası tutulmaz.
export type BuilderResponsiveOverrides<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
> = Partial<Record<BreakpointToken, BuilderBreakpointOverride<TContent, TStyle>>>;

// ------------------------------------------------------------
// Section — bir Page üzerine yerleştirilmiş Block+Variant örneği.
// (DB karşılığı ileride: business_site_sections — bu fazda tablo açılmadı.)
// ------------------------------------------------------------
export interface BuilderSection<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
> {
  id: string;
  businessId: string;
  pageId: string;
  blockKey: BlockKey;
  variantKey: VariantKey;
  position: number;
  active: boolean;
  content: TContent;
  style: TStyle;
  responsive: BuilderResponsiveOverrides<TContent, TStyle>;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// Page — bir route (Home/Services/Vehicles/... veya gelecekte custom).
// (DB karşılığı ileride: business_site_pages.)
// ------------------------------------------------------------
export interface BuilderPage {
  id: string;
  businessId: string;
  key: string; // "home" | "services" | "vehicles" | ... | özel slug
  title: string;
  isSystemPage: boolean; // true: platformun tanıdığı sabit sayfa (silinemez)
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Sayfa + ona ait sıralı section listesi birlikte kullanılacağı yerler için
// (örn. Section Builder ekranı) — ayrı bir DB tablosu DEĞİL, yalnızca bir
// birleşik görünüm tipidir.
export interface BuilderPageWithSections extends BuilderPage {
  sections: BuilderSection[];
}

// ------------------------------------------------------------
// Draft / Published ayrımı — mevcut PublishedTranslationRecord deseninin
// jenerik devamı. Draft için ayrı bir tip YOK: BuilderPage/BuilderSection'ın
// kendisi taslaktır (mevcut business_services vb. desenle tutarlı).
// ------------------------------------------------------------
export type PublishedRecord<T> = T & { revisionId: string };
export type PublishedBuilderPage = PublishedRecord<BuilderPage>;
export type PublishedBuilderSection = PublishedRecord<BuilderSection>;

// ------------------------------------------------------------
// Template — yalnızca kod-içi bir "seed kaynağı". Seçildiğinde business'ın
// KENDİ BuilderPage/BuilderSection kayıtlarını oluşturmak için kullanılır;
// seçim sonrası registry ile canlı bir bağı KALMAZ (Theme Registry'nin
// Object.freeze ile donuk tutulma mantığının aynısı: yalnızca başlangıç
// değeri kaynağı, referans değil). Bu yüzden Template değişse/güncellense
// bile daha önce o template'ten oluşturulmuş business'ların içeriği ETKİLENMEZ.
// ------------------------------------------------------------
export interface BuilderTemplateSectionSeed<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
> {
  blockKey: BlockKey;
  variantKey: VariantKey;
  // Sayfa içindeki sırası — 0'dan başlar, sayfa içinde benzersiz ve boşluksuz
  // (0,1,2,...) olmalı. Template Registry (Faz 4) bunu kayıt anında doğrular.
  position: number;
  active: boolean;
  content: TContent;
  style?: Partial<TStyle>;
  responsive?: BuilderResponsiveOverrides<TContent, TStyle>;
}

export interface BuilderTemplatePageSeed {
  pageKey: string;
  title: string;
  isSystemPage: boolean;
  sections: BuilderTemplateSectionSeed[];
}

// Faz 5'teki (Preview Renderer) admin "template seç" ekranının ihtiyaç
// duyacağı metadata — bu fazda hiçbir gerçek görsel/thumbnail üretilmez,
// yalnızca ileride tüketilecek şekil hazırlanır.
export interface TemplatePreviewMetadata {
  thumbnailKey: string;
  desktopPreviewWidth: number;
  tabletPreviewWidth: number;
  mobilePreviewWidth: number;
  tagline: string;
  featureBadges: string[];
  recommendedIndustry: string;
  recommendedColorMode: ThemeColorModeToken;
}

// SEO niyeti — gerçek business verisiyle DOLDURULACAK şablon metinleridir
// ("{business}" gibi yer tutucular ileride gerçek işletme adıyla değiştirilir),
// kendi başına yayınlanabilir nihai SEO metni değildir.
export interface TemplateSeoIntent {
  metaTitleHint: string;
  metaDescriptionHint: string;
  primaryKeywords: string[];
}

export interface BuilderTemplate {
  key: string;
  label: string;
  description: string;
  // Admin UI'da gruplama için (ör. "general", "premium", "shuttle") — Block'un
  // `family` alanıyla aynı serbest-metin mantığı: yeni bir kategori eklemek
  // bu dosyayı değiştirmeyi gerektirmez.
  category: string;
  themeKey: ThemeTemplateKey;
  preview: TemplatePreviewMetadata;
  supportedLocales: string[];
  seoIntent: TemplateSeoIntent;
  targetCustomerProfile: string;
  pages: BuilderTemplatePageSeed[];
}

// ------------------------------------------------------------
// Block Definition — Faz 3'te (Block Registry) somut örnekleri (Hero,
// ServicesGrid, CTA...) bu şekle göre doldurulacak. Bu fazda YALNIZCA şekil
// (interface) tanımlanır, hiçbir somut Block örneği YOKTUR.
// ------------------------------------------------------------
export interface BlockVariantDefinition {
  key: VariantKey;
  label: string;
  description?: string;
}

export interface BuilderValidationIssue {
  path: string;
  message: string;
}

export interface BuilderValidationResult<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
> {
  valid: boolean;
  issues: BuilderValidationIssue[];
  // Doğrulama sonrası NORMALİZE edilmiş içerik/stil — bilinmeyen anahtarlar
  // düşürülmüş, eksik alanlar varsayılanlarla doldurulmuş halidir. Sunucu
  // tarafı yazma işlemleri her zaman bu alanları kullanır, ham girdiyi değil.
  content: TContent;
  style: TStyle;
}

// Doğrulayıcıya giren veri her zaman `unknown` kabul edilir: ister istemciden
// (API body), ister DB'den (jsonb okuma) gelsin, tip güvenliği garantisi
// YOKTUR — `validate()` bunu ilk elden `unknown` olarak ele almak zorundadır.
export interface BlockValidationInput {
  variantKey: VariantKey;
  content: unknown;
  style: unknown;
  responsive: unknown;
}

export interface BlockRendererProps<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
  TData = undefined,
> {
  section: BuilderSection<TContent, TStyle>;
  // SSR'de her zaman "desktop" ile render edilir (mevcut sayfaların
  // force-dynamic + server-component disiplini korunur); breakpoint'e özel
  // görünüm CSS/responsive override üzerinden, ayrı bir render çağrısı
  // OLMADAN elde edilir. Bu alan yalnızca Live Preview'ın (Faz 5) iframe
  // modunda "şu an hangi breakpoint simüle ediliyor" bilgisini taşımak için
  // vardır.
  breakpoint: BreakpointToken;
  // Bloğun kendi content/style'ı DIŞINDA, mevcut içerik modelinden (örn.
  // business_services satırları) beslenmesi gereken bloklar için (Hero/CTA
  // gibi tamamen kendi kendine yeten bloklarda `undefined` kalır). Bu alan
  // sayesinde ServicesGrid gibi bloklar "mevcut services/vehicles/routes/blog
  // CRUD'u aynen kalır, Builder yalnızca gösterimi yönetir" ilkesini bozmadan
  // gerçek veriyle render edilebilir.
  data: TData;
}

// SEO'ya etkisi — Section Builder ileride "bu sayfada birden fazla H1 var"
// gibi uyarılar üretebilsin diye her blok kendi etkisini beyan eder.
export interface BlockSeoImpact {
  headingLevel: "h1" | "h2" | "h3" | "none";
  // Arama motoru için sayfanın "ana içeriği" sayılır mı (dekoratif/boilerplate
  // bir blok değil) — sitemap/İçerik-zenginliği değerlendirmeleri için.
  isPrimaryContent: boolean;
}

// Bu blok hangi responsive override kategorilerini GERÇEKTEN destekliyor —
// Section Builder UI'ı yalnızca burada true olan kontrolleri gösterir,
// desteklenmeyen bir alanı düzenleterek kullanıcıyı yanıltmaz.
export interface BlockResponsiveCapabilities {
  supportsVisibilityToggle: boolean;
  supportsReorder: boolean;
  supportsContentOverride: boolean;
  supportsStyleOverride: boolean;
}

// "all": her temayla uyumlu (büyük çoğunluk). Belirli temalara özgü bloklar
// için (ör. yalnızca Luxury'de anlamlı bir blok) açık bir liste verilir.
export type BlockThemeCompatibility = "all" | ThemeTemplateKey[];

// Faz 10'daki (drag & drop) admin "blok ekle" paletinin ihtiyaç duyacağı
// metadata — bu fazda hiçbir dnd kütüphanesi kurulmuyor, yalnızca ileride
// o palet tarafından tüketilecek şekil hazırlanıyor.
export interface BlockDragDropMetadata {
  icon: string;
  thumbnail?: string;
  paletteGroup: string;
  draggable: boolean;
}

export interface BlockDefinition<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
  TData = undefined,
> {
  key: BlockKey;
  version: number;
  label: string;
  description: string;
  // Admin UI'da gruplama için (Hero/Services/Vehicles/Routes/Diğer) —
  // kapalı bir union değil, serbest metin: yeni bir aile eklemek registry
  // dışında hiçbir dosyayı değiştirmeyi gerektirmez.
  family: string;
  variants: BlockVariantDefinition[];
  defaultContent: (variantKey: VariantKey) => TContent;
  defaultStyle: (variantKey: VariantKey) => TStyle;
  validate: (input: BlockValidationInput) => BuilderValidationResult<TContent, TStyle>;
  // Bilinçli olarak FunctionComponent (ComponentType değil): bu sistemde
  // hiçbir class component YOK — hepsi saf fonksiyon. Bu daraltma, Preview
  // Renderer katmanının (Faz 5) renderer'ları class-uyumluluğu aramadan
  // güvenle DÜZ FONKSİYON olarak çağırıp senkron hataları try/catch ile
  // yakalayabilmesini sağlıyor (bkz. components/builder/section-preview.tsx).
  PreviewRenderer: FunctionComponent<BlockRendererProps<TContent, TStyle, TData>>;
  PublicRenderer: FunctionComponent<BlockRendererProps<TContent, TStyle, TData>>;
  Fallback: FunctionComponent<{ reason?: string }>;
  seoImpact: BlockSeoImpact;
  responsiveCapabilities: BlockResponsiveCapabilities;
  themeCompatibility: BlockThemeCompatibility;
  dragDrop: BlockDragDropMetadata;
}
