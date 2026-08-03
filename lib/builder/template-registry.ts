import { getBlockDefinition } from "@/lib/builder/registry";
import type { BuilderTemplate, BuilderTemplatePageSeed, BuilderTemplateSectionSeed } from "@/lib/builder/types";
import { THEME_REGISTRY } from "@/lib/theme-registry";

// Template Registry — Faz 4. Block Registry'nin (Faz 3) aynı desenini
// tekrarlar: modül-özel Map, yalnızca fonksiyonlar üzerinden erişim,
// Object.freeze ile runtime mutasyon koruması, kayıt anında SIKI doğrulama.
//
// Template'ler birbirine bağımlı DEĞİLDİR — her biri kendi dosyasında
// tanımlanır ve kendi kendine registerTemplate() çağırır (bkz.
// lib/builder/templates/index.ts). Bu dosya yalnızca nötr alt yapıdır.
const templateRegistry = new Map<string, BuilderTemplate>();

export class DuplicateTemplateKeyError extends Error {
  constructor(key: string) {
    super(`Template zaten kayıtlı: "${key}". Her template anahtarı yalnızca bir kez kayıt edilebilir.`);
    this.name = "DuplicateTemplateKeyError";
  }
}

export class InvalidTemplateDefinitionError extends Error {
  constructor(key: string, reason: string) {
    super(`Geçersiz template tanımı ("${key}"): ${reason}`);
    this.name = "InvalidTemplateDefinitionError";
  }
}

function assertValidSectionSeed(
  templateKey: string,
  pageKey: string,
  seed: BuilderTemplateSectionSeed,
): void {
  const definition = getBlockDefinition(seed.blockKey);

  if (!definition) {
    throw new InvalidTemplateDefinitionError(
      templateKey,
      `Bilinmeyen block_key: "${seed.blockKey}" (sayfa: "${pageKey}"). Block Registry'de kayıtlı değil.`,
    );
  }

  const variantExists = definition.variants.some((variant) => variant.key === seed.variantKey);

  if (!variantExists) {
    throw new InvalidTemplateDefinitionError(
      templateKey,
      `Bilinmeyen variant_key: "${seed.variantKey}" (block: "${seed.blockKey}", sayfa: "${pageKey}").`,
    );
  }

  const validated = definition.validate({
    variantKey: seed.variantKey,
    content: seed.content,
    style: seed.style ?? {},
    responsive: seed.responsive ?? {},
  });

  if (!validated.valid) {
    const issueSummary = validated.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
    throw new InvalidTemplateDefinitionError(
      templateKey,
      `Section seed'i block'un kendi validate()'inden GEÇEMEDİ (block: "${seed.blockKey}", sayfa: "${pageKey}"). ` +
        `Profesyonel bir template seed'i zaten geçerli veri taşımalı — bu bir template YAZIM hatasıdır: ${issueSummary}`,
    );
  }
}

function assertSequentialPositions(templateKey: string, page: BuilderTemplatePageSeed): void {
  const positions = page.sections.map((section) => section.position);
  const uniquePositions = new Set(positions);

  if (uniquePositions.size !== positions.length) {
    throw new InvalidTemplateDefinitionError(
      templateKey,
      `Sayfa "${page.pageKey}" içinde birbirini tekrar eden section position değerleri var: [${positions.join(", ")}].`,
    );
  }

  const sorted = [...positions].sort((a, b) => a - b);
  const isSequentialFromZero = sorted.every((position, index) => position === index);

  if (!isSequentialFromZero) {
    throw new InvalidTemplateDefinitionError(
      templateKey,
      `Sayfa "${page.pageKey}" section position değerleri 0'dan başlayıp boşluksuz sıralı olmalı, bulunan: [${sorted.join(", ")}].`,
    );
  }
}

function assertValidPageSeed(templateKey: string, page: BuilderTemplatePageSeed): void {
  if (!page.pageKey.trim()) {
    throw new InvalidTemplateDefinitionError(templateKey, "page_key boş olamaz.");
  }

  if (page.sections.length === 0) {
    throw new InvalidTemplateDefinitionError(templateKey, `Sayfa "${page.pageKey}" hiç section içermiyor.`);
  }

  assertSequentialPositions(templateKey, page);

  for (const section of page.sections) {
    assertValidSectionSeed(templateKey, page.pageKey, section);
  }
}

function assertValidTemplate(definition: BuilderTemplate): void {
  if (!definition.key.trim()) {
    throw new InvalidTemplateDefinitionError(definition.key, "key boş olamaz.");
  }

  if (definition.pages.length === 0) {
    throw new InvalidTemplateDefinitionError(definition.key, "en az bir page seed tanımlanmalı.");
  }

  const pageKeys = new Set(definition.pages.map((page) => page.pageKey));

  if (pageKeys.size !== definition.pages.length) {
    throw new InvalidTemplateDefinitionError(definition.key, "page_key değerleri template içinde benzersiz olmalı.");
  }

  if (!(definition.themeKey in THEME_REGISTRY)) {
    throw new InvalidTemplateDefinitionError(
      definition.key,
      `Geçersiz themeKey: "${definition.themeKey}". Theme Registry'de kayıtlı değil.`,
    );
  }

  if (definition.supportedLocales.length === 0) {
    throw new InvalidTemplateDefinitionError(definition.key, "en az bir desteklenen locale tanımlanmalı.");
  }

  for (const page of definition.pages) {
    assertValidPageSeed(definition.key, page);
  }
}

// Her template dosyası kendi modülü yüklendiğinde (top-level) bu fonksiyonu
// çağırır (bkz. lib/builder/templates/index.ts). Yeni bir template eklemek
// için: (1) yeni dosyayı oluştur, (2) templates/index.ts'e tek satır import
// ekle. Mevcut template dosyalarına dokunmak gerekmez.
export function registerTemplate(definition: BuilderTemplate): void {
  assertValidTemplate(definition);

  if (templateRegistry.has(definition.key)) {
    throw new DuplicateTemplateKeyError(definition.key);
  }

  templateRegistry.set(definition.key, Object.freeze(definition));
}

export function getTemplateDefinition(key: string): BuilderTemplate | undefined {
  return templateRegistry.get(key);
}

export function listTemplateDefinitions(): BuilderTemplate[] {
  return Array.from(templateRegistry.values());
}

export function listTemplatesByCategory(category: string): BuilderTemplate[] {
  return listTemplateDefinitions().filter((definition) => definition.category === category);
}

export function listTemplateCategories(): string[] {
  return Array.from(new Set(listTemplateDefinitions().map((definition) => definition.category)));
}

// Yalnızca testler/tanılama için — production kod yolunda kullanılmaz.
export function getRegisteredTemplateCount(): number {
  return templateRegistry.size;
}
