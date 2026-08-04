import "server-only";

import { cache } from "react";
import { getLatestPublishedBuilderDocumentRow } from "@/lib/builder/publish-store";
import { loadPublishedBuilderTranslationLookup, resolveBuilderPageSeoOverride } from "@/lib/builder/translations";
import type { WorkspacePage } from "@/lib/builder/workspace-state";
import type { PublishedTranslationRecord, TranslationDraftRecord } from "@/lib/content-translations";

// ============================================================
// Faz 11/12/13 — public site icin "bu business'in yayinlanmis bir builder
// sayfasi var mi?" cozumleme katmani. Legacy fallback sozlesmesi burada
// netlesir:
// - Supabase baglantisi yoksa, hic publish edilmemisse, sayfa key'i
//   bulunamiyorsa, sayfa pasifse veya document/section'lar bozuksa -> null
//   doner ve caller LEGACY render'a devam eder.
// - Bu fonksiyon ASLA throw etmez: bozuk bir published snapshot public
//   siteyi asla cokertmemeli ("malformed snapshot public siteyi
//   cokertmemeli" ilkesi save/publish katmanindan render katmanina da tasindi).
//
// Faz 12: her route hem generateMetadata() hem sayfa component'i icinde
// AYNI (businessId, pageKey) ile bu fonksiyonu cagirir. React'in cache()
// sarmalayicisi, tek bir HTTP isteği icinde ayni argumanlarla yapilan
// tekrar cagrilari otomatik dedupe eder — boylece published builder
// document tek bir istekte yalnizca BIR KEZ okunur (item 11: "Builder
// document bir kez okunmalı"). Bu, mevcut cache/revalidate mimarisini
// DEGISTIRMEZ; yalnizca ayni request icindeki tekrar eden okumayi onler.
//
// Faz 13: doneni {page, revisionId} olarak genisletildi — cok dilli ceviri
// cozumlemesi icin (business_publication_translations) revisionId sart.
// Yalnizca published revision ile eslesen ceviri kullanilir; draft
// cevirisi (henuz publish edilmemis) ASLA buradan okunmaz.
// ============================================================

export type ResolvedPublishedBuilderPage = {
  page: WorkspacePage;
  revisionId: string;
};

export const resolvePublishedBuilderPage = cache(async function resolvePublishedBuilderPage(
  businessId: string,
  pageKey: string,
): Promise<ResolvedPublishedBuilderPage | null> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return null;
  }

  try {
    const row = await getLatestPublishedBuilderDocumentRow(safeBusinessId);

    if (!row) {
      return null;
    }

    const page = row.document.workspace.pages.find((entry) => entry.key === pageKey);

    if (!page || !page.active || !Array.isArray(page.sections) || page.sections.length === 0) {
      return null;
    }

    const hasActiveSection = page.sections.some((section) => section.active);
    if (!hasActiveSection) {
      return null;
    }

    return { page, revisionId: row.revisionId };
  } catch (error) {
    console.warn("resolvePublishedBuilderPage failed, falling back to legacy render", {
      businessId: safeBusinessId,
      pageKey,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
});

// Belirli bir published revision icin builder ceviri lookup'ini yukler.
// Hata durumunda (bozuk satir, baglanti sorunu) BOS bir Map doner — cagiran
// taraf bunu "override yok, default locale'e dus" olarak yorumlar, asla
// throw etmez (render katmani hicbir zaman cokmez).
export const resolvePublishedBuilderTranslations = cache(async function resolvePublishedBuilderTranslations(
  businessId: string,
  revisionId: string,
): Promise<Map<string, TranslationDraftRecord | PublishedTranslationRecord>> {
  if (!businessId.trim() || !revisionId.trim()) {
    return new Map();
  }

  try {
    return await loadPublishedBuilderTranslationLookup(businessId, revisionId);
  } catch (error) {
    console.warn("resolvePublishedBuilderTranslations failed, falling back to default locale", {
      businessId,
      revisionId,
      message: error instanceof Error ? error.message : String(error),
    });
    return new Map();
  }
});

const SEO_TITLE_MAX_LENGTH = 70;
const SEO_DESCRIPTION_MAX_LENGTH = 160;

function interpolateBusinessName(hint: string, businessName: string): string {
  return hint.replace(/\{business\}/g, businessName).trim();
}

function sanitizeSeoText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() : trimmed;
}

// Builder sayfasinin seoTitleHint/seoDescriptionHint alanlarini gercek
// metadata metnine cevirir. "{business}" placeholder'ini (bkz.
// workspace-state.ts PAGE_BLUEPRINTS) gercek isletme adiyla degistirir —
// bu adim olmadan public <title> literal olarak "{business} | ..." gibi
// gorunurdu. Bos/gecersiz hint -> null (caller fallback zincirine devam eder).
//
// Faz 13: localeOverride verilirse (secili dil icin cevrilmis SEO metni),
// interpolasyon/sanitizasyon ONA uygulanir — fallback sirasi netlesir:
// 1) locale builder SEO cevirisi, 2) varsayilan builder SEO hint,
// 3) (caller tarafinda) business SEO, 4) legacy fallback.
export function resolveBuilderSeoHints(
  page: WorkspacePage | null,
  businessName: string,
  localeOverride?: { seoTitleHint: string | null; seoDescriptionHint: string | null },
): { title: string | null; description: string | null } {
  if (!page) {
    return { title: null, description: null };
  }

  const rawTitle =
    localeOverride?.seoTitleHint || (typeof page.seoTitleHint === "string" ? page.seoTitleHint : "");
  const rawDescription =
    localeOverride?.seoDescriptionHint || (typeof page.seoDescriptionHint === "string" ? page.seoDescriptionHint : "");

  const title = rawTitle ? sanitizeSeoText(interpolateBusinessName(rawTitle, businessName), SEO_TITLE_MAX_LENGTH) : "";
  const description = rawDescription
    ? sanitizeSeoText(interpolateBusinessName(rawDescription, businessName), SEO_DESCRIPTION_MAX_LENGTH)
    : "";

  return {
    title: title || null,
    description: description || null,
  };
}

export { resolveBuilderPageSeoOverride };
