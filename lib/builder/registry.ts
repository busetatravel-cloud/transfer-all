import type { BlockDefinition, BlockKey, JsonRecord } from "@/lib/builder/types";

// Block Registry — TEK doğruluk kaynağı. Modül-özel (private) bir Map
// içinde tutulur; dışarıya yalnızca registerBlock/getBlockDefinition/
// listBlockDefinitions* fonksiyonları üzerinden erişilir. Bu sayede
// registry'nin kendisi hiçbir yerden doğrudan mutasyona uğratılamaz.
//
// Performans: anahtar bazlı arama O(1) (Map.get). Aile/kategori bazlı
// listeleme O(n) filtre — blok sayısı yüzlere çıksa bile (admin UI'da
// "blok ekle" paleti render edilirken) önemsiz bir maliyettir; gerçek
// public sayfa render'ı yalnızca getBlockDefinition (O(1)) kullanır.
const registry = new Map<BlockKey, BlockDefinition>();

export class DuplicateBlockKeyError extends Error {
  constructor(key: BlockKey) {
    super(`Block zaten kayıtlı: "${key}". Her blok anahtarı yalnızca bir kez kayıt edilebilir.`);
    this.name = "DuplicateBlockKeyError";
  }
}

export class InvalidBlockDefinitionError extends Error {
  constructor(key: BlockKey, reason: string) {
    super(`Geçersiz blok tanımı ("${key}"): ${reason}`);
    this.name = "InvalidBlockDefinitionError";
  }
}

function assertValidDefinition<
  TContent extends JsonRecord,
  TStyle extends JsonRecord,
  TData,
>(definition: BlockDefinition<TContent, TStyle, TData>): void {
  if (!definition.key) {
    throw new InvalidBlockDefinitionError(definition.key, "key boş olamaz.");
  }

  if (definition.variants.length === 0) {
    throw new InvalidBlockDefinitionError(definition.key, "en az bir variant tanımlanmalı.");
  }

  const variantKeys = new Set(definition.variants.map((variant) => variant.key));
  if (variantKeys.size !== definition.variants.length) {
    throw new InvalidBlockDefinitionError(definition.key, "variant anahtarları benzersiz olmalı.");
  }
}

// Her blok kendi dosyasında bu fonksiyonu MODÜL YÜKLENME anında (top-level)
// çağırır (bkz. lib/builder/blocks/index.ts). Bloklar birbirini import etmez;
// yalnızca bu registry'yi ve lib/builder/types.ts + components/builder/
// primitives.tsx gibi nötr alt yapıyı paylaşırlar.
export function registerBlock<
  TContent extends JsonRecord = JsonRecord,
  TStyle extends JsonRecord = JsonRecord,
  TData = undefined,
>(definition: BlockDefinition<TContent, TStyle, TData>): void {
  assertValidDefinition(definition);

  if (registry.has(definition.key)) {
    throw new DuplicateBlockKeyError(definition.key);
  }

  // Bilinçli tip silme (type erasure) noktası: farklı TContent/TStyle/TData
  // ile somutlaşmış BlockDefinition'lar TEK bir heterojen Map'te saklanır
  // (registry, hangi bloğun hangi somut şekle sahip olduğunu STATİK olarak
  // bilemez — bu yüzden runtime'da her zaman `unknown` ile ele alınır, asla
  // `any` ile değil). Bu, TypeScript'te jenerik bir registry kurarken
  // kaçınılmaz, tek ve izole edilmiş bir "existential type" sınırıdır.
  registry.set(definition.key, Object.freeze(definition) as unknown as BlockDefinition);
}

export function getBlockDefinition(key: BlockKey): BlockDefinition | undefined {
  return registry.get(key);
}

export function listBlockDefinitions(): BlockDefinition[] {
  return Array.from(registry.values());
}

export function listBlockDefinitionsByFamily(family: string): BlockDefinition[] {
  return listBlockDefinitions().filter((definition) => definition.family === family);
}

export function listBlockFamilies(): string[] {
  return Array.from(new Set(listBlockDefinitions().map((definition) => definition.family)));
}

// Yalnızca testler/tanılama için — production kod yolunda kullanılmaz.
export function getRegisteredBlockCount(): number {
  return registry.size;
}
