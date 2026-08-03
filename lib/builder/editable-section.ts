import { getBlockDefinition } from "@/lib/builder/registry";
import type {
  BlockKey,
  BuilderTemplatePageSeed,
  BuilderResponsiveOverrides,
  JsonRecord,
  VariantKey,
} from "@/lib/builder/types";

// ============================================================
// Website Builder admin UI — düzenlenebilir section state'i (Faz 6).
//
// Bu dosya React'ten bağımsızdır (saf mantık) — hem sunucuda hem tarayıcıda
// (client component bundle'ı içinde) çalışabilir. Hiçbir DB/network çağrısı
// yapmaz; yalnızca bellek-içi bir dizi üzerinde çalışır. WebsiteBuilderShell
// bu state'i tutar, hiçbir zaman kalıcı hale getirmez.
// ============================================================

export interface EditableSection {
  id: string;
  blockKey: BlockKey;
  variantKey: VariantKey;
  position: number;
  active: boolean;
  content: JsonRecord;
  style: JsonRecord;
  responsive: BuilderResponsiveOverrides;
}

function generateSectionId(blockKey: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${blockKey}-${crypto.randomUUID()}`;
  }
  return `${blockKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Bir template'in sayfa seed'inden düzenlenebilir bir kopya üretir. Seed'in
// KENDİSİ hiç mutasyona uğramaz (Template Registry'nin Object.freeze'i zaten
// buna izin vermez) — her section, bloğun kendi validate()'inden geçirilerek
// TAM normalize edilmiş content/style ile başlatılır.
export function seedEditableSectionsFromPage(page: BuilderTemplatePageSeed): EditableSection[] {
  return page.sections
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((seed, index) => {
      const definition = getBlockDefinition(seed.blockKey);
      const validated = definition?.validate({
        variantKey: seed.variantKey,
        content: seed.content,
        style: seed.style ?? {},
        responsive: seed.responsive ?? {},
      });

      return {
        id: generateSectionId(seed.blockKey),
        blockKey: seed.blockKey,
        variantKey: seed.variantKey,
        position: index,
        active: seed.active,
        content: validated?.content ?? seed.content,
        style: validated?.style ?? (seed.style as JsonRecord | undefined) ?? {},
        responsive: seed.responsive ?? {},
      } satisfies EditableSection;
    });
}

function withRecalculatedPositions(sections: EditableSection[]): EditableSection[] {
  return sections.map((section, index) => ({ ...section, position: index }));
}

// Sürükle-bırak ile yeniden sıralama — `fromId` section'ını `toId`
// section'ının konumuna taşır.
export function reorderSections(
  sections: EditableSection[],
  fromId: string,
  toId: string,
): EditableSection[] {
  if (fromId === toId) {
    return sections;
  }

  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const fromIndex = ordered.findIndex((section) => section.id === fromId);
  const toIndex = ordered.findIndex((section) => section.id === toId);

  if (fromIndex === -1 || toIndex === -1) {
    return sections;
  }

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);

  return withRecalculatedPositions(ordered);
}

// Klavye/erişilebilirlik dostu alternatif — ok butonlarıyla bir yukarı/bir
// aşağı taşıma. Sürükle-bırak native HTML5 API'si klavye ile kullanılamadığı
// için bu, aynı sıralama yeteneğinin erişilebilir karşılığıdır.
export function moveSection(
  sections: EditableSection[],
  id: string,
  direction: "up" | "down",
): EditableSection[] {
  const ordered = [...sections].sort((a, b) => a.position - b.position);
  const index = ordered.findIndex((section) => section.id === id);

  if (index === -1) {
    return sections;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= ordered.length) {
    return sections;
  }

  const [moved] = ordered.splice(index, 1);
  ordered.splice(targetIndex, 0, moved);

  return withRecalculatedPositions(ordered);
}

export function toggleSectionActive(sections: EditableSection[], id: string): EditableSection[] {
  return sections.map((section) => (section.id === id ? { ...section, active: !section.active } : section));
}

export function updateSectionContent(
  sections: EditableSection[],
  id: string,
  patch: JsonRecord,
): EditableSection[] {
  return sections.map((section) =>
    section.id === id ? { ...section, content: { ...section.content, ...patch } } : section,
  );
}

export function updateSectionStyle(
  sections: EditableSection[],
  id: string,
  patch: JsonRecord,
): EditableSection[] {
  return sections.map((section) =>
    section.id === id ? { ...section, style: { ...section.style, ...patch } } : section,
  );
}
