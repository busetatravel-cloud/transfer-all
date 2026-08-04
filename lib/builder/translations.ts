import "server-only";

import { getBusinessBuilderDraft } from "@/lib/builder/draft-store";
import {
  readBusinessTranslationDrafts,
  readBusinessPublishedTranslationsByRevision,
  replaceBusinessTranslationDrafts,
  replacePublishedTranslationsForRevision,
  buildTranslationDraftLookup,
  type PublishedTranslationRecord,
  type TranslationDraftRecord,
  type TranslationFieldKey,
} from "@/lib/content-translations";
import { normalizeLanguageCode } from "@/lib/languages";
import type { WorkspacePage, WorkspaceSnapshot } from "@/lib/builder/workspace-state";
import type { BlockKey, JsonRecord } from "@/lib/builder/types";
import {
  getTranslatablePageFields,
  getTranslatableSectionFields,
} from "@/lib/builder/translatable-fields";

export { getTranslatablePageFields, getTranslatableSectionFields };

// ============================================================
// Website Builder Faz 13 — coklu dil.
//
// En dusuk riskli entegrasyon secildi: builder document'i (JSON) HICBIR
// zaman locale-nested hale getirilmiyor (ör. content.title.en gibi bir
// yapi YOK) — varsayilan locale icerigi her zaman document'in kendisinde
// kalir. Farkli locale'lerdeki DEGERLER, mevcut business_content_translations
// / business_publication_translations tablolarinda, "builder" section'i +
// section/page id'si (sourceId) + alan adi (fieldKey) ile saklanir — TAM
// OLARAK service/vehicle/route/blog icin zaten kullanilan desenin aynisi
// (bkz. lib/content-translations.ts), yeni migration gerekmez.
//
// Whitelist: yalnizca Hero/CTA/ServicesGrid'in metin alanlari cevrilebilir.
// href alanlari ASLA bu listede degildir (URL'ler cevrilmez).
// ============================================================

const MAX_TRANSLATION_LENGTH = 240;

type BuilderSourceLookup =
  | { kind: "page"; page: WorkspacePage }
  | { kind: "section"; page: WorkspacePage; blockKey: BlockKey; content: JsonRecord }
  | null;

function findBuilderSource(workspace: WorkspaceSnapshot, sourceId: string): BuilderSourceLookup {
  for (const page of workspace.pages) {
    if (page.id === sourceId) {
      return { kind: "page", page };
    }

    const section = page.sections.find((entry) => entry.id === sourceId);
    if (section) {
      return { kind: "section", page, blockKey: section.blockKey, content: section.content };
    }
  }

  return null;
}

function sanitizeTranslationText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_TRANSLATION_LENGTH);
}

export type BuilderTranslationEntryInput = {
  sourceId?: unknown;
  fieldKey?: unknown;
  translatedText?: unknown;
};

export type BuilderTranslationSaveIssue = {
  sourceId: string;
  fieldKey: string;
  message: string;
};

// businessId'ye ait draft'in KENDI page/section id'lerine karsi dogrular —
// baska bir tenant'in (tahmin edilse bile) section id'sine ceviri yazilamaz,
// cunku o id bu business'in KENDI workspace'inde bulunmadikca reddedilir.
// Bilinmeyen sourceId/fieldKey veya block schema'sinin izin vermedigi bir
// alan sessizce degil, acik bir issue ile reddedilir.
export async function saveBuilderTranslations({
  businessId,
  localeCode,
  entries,
}: {
  businessId: string;
  localeCode: string;
  entries: BuilderTranslationEntryInput[];
}): Promise<{ saved: TranslationDraftRecord[]; issues: BuilderTranslationSaveIssue[] }> {
  const normalizedLocale = normalizeLanguageCode(localeCode);

  if (!normalizedLocale) {
    throw new Error("invalid_locale");
  }

  const draft = await getBusinessBuilderDraft(businessId);

  if (!draft) {
    throw new Error("draft_not_found");
  }

  const workspace = draft.document.workspace;
  const existingRows = await readBusinessTranslationDrafts(businessId);

  const merged = new Map<
    string,
    { sourceId: string; fieldKey: TranslationFieldKey; sourceText: string; translatedText: string }
  >();

  for (const row of existingRows) {
    if (row.section === "builder" && row.localeCode === normalizedLocale) {
      merged.set(`${row.sourceId}:${row.fieldKey}`, {
        sourceId: row.sourceId,
        fieldKey: row.fieldKey,
        sourceText: row.sourceText,
        translatedText: row.translatedText,
      });
    }
  }

  const issues: BuilderTranslationSaveIssue[] = [];

  for (const entry of entries) {
    const sourceId = typeof entry.sourceId === "string" ? entry.sourceId.trim() : "";
    const fieldKey = typeof entry.fieldKey === "string" ? entry.fieldKey.trim() : "";

    if (!sourceId || !fieldKey) {
      issues.push({ sourceId, fieldKey, message: "sourceId ve fieldKey zorunlu." });
      continue;
    }

    const found = findBuilderSource(workspace, sourceId);

    if (!found) {
      issues.push({ sourceId, fieldKey, message: "Bu businessa ait bilinen bir sayfa/section degil." });
      continue;
    }

    const allowedFields =
      found.kind === "page" ? getTranslatablePageFields() : getTranslatableSectionFields(String(found.blockKey));

    if (!allowedFields.includes(fieldKey as TranslationFieldKey)) {
      issues.push({ sourceId, fieldKey, message: "Bu alan bu sayfa/blok icin cevrilebilir degil." });
      continue;
    }

    const sourceText =
      found.kind === "page"
        ? String((found.page as unknown as Record<string, unknown>)[fieldKey] ?? "")
        : String((found.content as Record<string, unknown>)[fieldKey] ?? "");

    const translatedText = sanitizeTranslationText(entry.translatedText);
    const key = `${sourceId}:${fieldKey}`;

    if (!translatedText) {
      // Bos override = "bu dilde henuz ceviri yok" — sil, default locale'e dus.
      merged.delete(key);
      continue;
    }

    merged.set(key, { sourceId, fieldKey: fieldKey as TranslationFieldKey, sourceText, translatedText });
  }

  const rows = Array.from(merged.values()).map((row) => ({
    localeCode: normalizedLocale,
    section: "builder" as const,
    sourceId: row.sourceId,
    fieldKey: row.fieldKey,
    sourceText: row.sourceText,
    translatedText: row.translatedText,
  }));

  const saved = await replaceBusinessTranslationDrafts(businessId, normalizedLocale, rows, "builder");
  return { saved, issues };
}

export async function loadBuilderTranslationDrafts(
  businessId: string,
  localeCode: string,
): Promise<TranslationDraftRecord[]> {
  const normalizedLocale = normalizeLanguageCode(localeCode);

  if (!normalizedLocale) {
    return [];
  }

  const rows = await readBusinessTranslationDrafts(businessId);
  return rows.filter((row) => row.section === "builder" && row.localeCode === normalizedLocale);
}

// Publish anında (lib/builder/publish-store.ts) çağrılır: o anki TÜM builder
// çeviri taslaklarını (her locale) yeni revisionId'ye kopyalar — immutable
// snapshot ilkesiyle tutarlı (published çeviri, draft değişse bile değişmez).
// Best-effort: başarısız olursa publish'in kendisini düşürmez (revizyon/
// doküman zaten atomik RPC ile güvenceye alındı); eksik çeviri, public
// render'da güvenli şekilde default locale'e düşer.
export async function snapshotBuilderTranslationsForRevision(
  businessId: string,
  revisionId: string,
): Promise<void> {
  const rows = await readBusinessTranslationDrafts(businessId);
  const builderRows = rows.filter((row) => row.section === "builder");

  if (!builderRows.length) {
    return;
  }

  await replacePublishedTranslationsForRevision(businessId, revisionId, builderRows);
}

export async function loadPublishedBuilderTranslationLookup(
  businessId: string,
  revisionId: string,
): Promise<Map<string, TranslationDraftRecord | PublishedTranslationRecord>> {
  const rows = await readBusinessPublishedTranslationsByRevision(businessId, revisionId);
  return buildTranslationDraftLookup(rows.filter((row) => row.section === "builder"));
}

function readOverride(
  lookup: Map<string, TranslationDraftRecord | PublishedTranslationRecord>,
  locale: string,
  fallbackLocale: string,
  sourceId: string,
  fieldKey: string,
): string | null {
  const primary = lookup.get(`${locale}:builder:${sourceId}:${fieldKey}`)?.translatedText;
  if (primary) {
    return primary;
  }

  if (locale !== fallbackLocale) {
    const fallback = lookup.get(`${fallbackLocale}:builder:${sourceId}:${fieldKey}`)?.translatedText;
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

// Section content'ine cevrilmis degerleri merge eder — yalnizca whitelist'teki
// alanlar degistirilir (href/style/diger her sey oldugu gibi kalir). Eksik
// override -> default locale content'i degismeden kalir (fallback zaten
// document'in kendisi oldugu icin ekstra bir islem gerekmez).
export function applyBuilderSectionTranslations(
  blockKey: BlockKey,
  content: JsonRecord,
  sourceId: string,
  lookup: Map<string, TranslationDraftRecord | PublishedTranslationRecord>,
  locale: string,
  fallbackLocale: string,
): JsonRecord {
  const fields = getTranslatableSectionFields(String(blockKey));

  // Varsayilan (fallback) locale zaten document'in kendisi — override
  // aramaya gerek yok, gereksiz Map lookup'u atlanir. Cevrilebilir alani
  // olmayan bir blok icin de erken cik.
  if (!fields.length || locale === fallbackLocale) {
    return content;
  }

  let changed = false;
  const next: JsonRecord = { ...content };

  for (const field of fields) {
    const override = readOverride(lookup, locale, fallbackLocale, sourceId, field);
    if (override !== null) {
      next[field] = override;
      changed = true;
    }
  }

  return changed ? next : content;
}

export function resolveBuilderPageSeoOverride(
  page: WorkspacePage,
  lookup: Map<string, TranslationDraftRecord | PublishedTranslationRecord>,
  locale: string,
  fallbackLocale: string,
): { seoTitleHint: string | null; seoDescriptionHint: string | null } {
  if (locale === fallbackLocale) {
    return { seoTitleHint: null, seoDescriptionHint: null };
  }

  return {
    seoTitleHint: readOverride(lookup, locale, fallbackLocale, page.id, "seoTitleHint"),
    seoDescriptionHint: readOverride(lookup, locale, fallbackLocale, page.id, "seoDescriptionHint"),
  };
}
