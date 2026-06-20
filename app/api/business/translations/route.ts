import { NextResponse } from "next/server";
import { requireApiBusinessSession } from "@/lib/auth";
import {
  getBusinessPanelData,
  updateBusinessPanelSection,
} from "@/lib/business-panel";
import { translateTexts } from "@/lib/ai-translation";
import {
  getSectionDescription,
  getSectionFieldOrder,
  getSectionSeeds,
  replaceBusinessTranslationDrafts,
  type TranslationSection,
} from "@/lib/content-translations";
import { getLanguageLabel, normalizeLanguageCode } from "@/lib/languages";

const TRANSLATABLE_SECTIONS = new Set<TranslationSection>([
  "company",
  "hero",
  "service",
  "vehicle",
  "route",
  "blog",
  "seo",
  "menus",
  "publicForm",
  "voucher",
  "booking",
]);

type ActionName =
  | "toggle_language"
  | "set_default_language"
  | "translate_language"
  | "translate_all_active";

function jsonOk(data: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...data });
}

function jsonError(
  code: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      ...(extra ?? {}),
    },
    { status },
  );
}

function normalizeSection(value: unknown) {
  if (value === "all") {
    return "all" as const;
  }

  return typeof value === "string" && TRANSLATABLE_SECTIONS.has(value as TranslationSection)
    ? (value as TranslationSection)
    : null;
}

function toStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function toBooleanValue(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function parseErrorResponse(error: unknown) {
  const fallback = {
    code: "internal_error",
    message: error instanceof Error ? error.message : "İşlem başarısız.",
    status: 500,
    rawText: "",
  };

  const candidate =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error
          ? JSON.stringify(error)
          : "";

  if (!candidate.trim()) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const code = typeof parsed.code === "string" ? parsed.code : fallback.code;
    const message = typeof parsed.message === "string" ? parsed.message : fallback.message;
    const status = Number(parsed.status ?? fallback.status);
    const rawText = typeof parsed.rawText === "string" ? parsed.rawText : "";
    return {
      code,
      message,
      status: Number.isFinite(status) ? status : fallback.status,
      rawText,
    };
  } catch {
    return fallback;
  }
}

function mapActionError(error: unknown) {
  const parsed = parseErrorResponse(error);

  if (parsed.code === "supabase_error") {
    const status =
      parsed.status === 409 || parsed.status === 400 || parsed.status === 422
        ? parsed.status
        : 400;
    return jsonError(parsed.code, parsed.message, status, {
      status: parsed.status,
      rawText: parsed.rawText,
    });
  }

  if (parsed.code === "default_locale_locked") {
    return jsonError(parsed.code, parsed.message, 409);
  }

  if (parsed.code === "locale_not_found" || parsed.code === "invalid_locale") {
    return jsonError(parsed.code, parsed.message, 422);
  }

  if (parsed.code === "invalid_section") {
    return jsonError(parsed.code, parsed.message, 400);
  }

  return jsonError(parsed.code, parsed.message, parsed.status || 500, {
    rawText: parsed.rawText || undefined,
  });
}

async function translateSection(
  businessId: string,
  panel: Awaited<ReturnType<typeof getBusinessPanelData>>,
  section: TranslationSection,
  targetLocale: string,
  sourceLocale: string,
) {
  const seeds = getSectionSeeds(panel)[section];

  if (!seeds.length) {
    return [];
  }

  const translatedTexts = await translateTexts({
    targetLocale,
    sourceLocale,
    section,
    fieldKeys: seeds.map((seed) => seed.fieldKey),
    texts: seeds.map((seed) => seed.sourceText),
    context: getSectionDescription(section),
  });

  return replaceBusinessTranslationDrafts(
    businessId,
    targetLocale,
    seeds.map((seed, index) => ({
      localeCode: targetLocale as never,
      section: seed.section,
      sourceId: seed.sourceId,
      fieldKey: seed.fieldKey,
      sourceText: seed.sourceText,
      translatedText: translatedTexts[index] ?? seed.sourceText,
    })),
    section,
  );
}

async function handleTranslateAction(
  businessId: string,
  panel: Awaited<ReturnType<typeof getBusinessPanelData>>,
  body: Record<string, unknown> | null,
) {
  const section = normalizeSection(body?.section);
  const targetLocale = normalizeLanguageCode(toStringValue(body?.targetLocale ?? body?.languageCode));
  const sourceLocale = normalizeLanguageCode(toStringValue(body?.sourceLocale)) ?? "tr";

  if (!section) {
    return jsonError("invalid_section", "Geçersiz çeviri alanı.", 400);
  }

  if (!targetLocale) {
    return jsonError("invalid_locale", "Geçersiz hedef dil.", 422);
  }

  console.info("business.translations.action", {
    action: "translate_language",
    languageCode: targetLocale,
    businessId,
  });

  const sections = section === "all" ? Array.from(TRANSLATABLE_SECTIONS) : [section];
  const drafts = [];

  for (const currentSection of sections) {
    const sectionDrafts = await translateSection(
      businessId,
      panel,
      currentSection,
      targetLocale,
      sourceLocale,
    );
    drafts.push(...sectionDrafts);
  }

  return jsonOk({
    data: {
      section,
      targetLocale,
      draftCount: drafts.length,
      draftLocale: targetLocale,
      sectionFields: section === "all" ? [] : getSectionFieldOrder(section),
      sectionDescription: section === "all" ? "Tüm bölümler" : getSectionDescription(section),
      drafts,
    },
  });
}

async function handleToggleLanguageAction(
  businessId: string,
  panel: Awaited<ReturnType<typeof getBusinessPanelData>>,
  body: Record<string, unknown> | null,
) {
  const languageCode = normalizeLanguageCode(toStringValue(body?.languageCode));
  const active = toBooleanValue(body?.active);

  console.info("business.translations.action", {
    action: "toggle_language",
    languageCode,
    businessId,
  });

  if (!languageCode) {
    return jsonError("invalid_locale", "Geçersiz dil kodu.", 422);
  }

  const defaultLocale = normalizeLanguageCode(panel.seo.defaultLocale);
  if (defaultLocale && defaultLocale === languageCode && !active) {
    return jsonError("default_locale_locked", "Varsayılan dil kapatılamaz.", 409);
  }

  const existing = panel.locales.find((locale) => normalizeLanguageCode(locale.code) === languageCode);
  const payload = {
    section: "locale" as const,
    action: existing ? ("update" as const) : ("create" as const),
    recordId: existing?.id,
    code: languageCode,
    name: existing?.name || getLanguageLabel(languageCode),
    active,
    published: existing?.published ?? false,
    translationComplete: existing?.translationComplete ?? false,
  };

  console.info("business.translations.toggle.payload", {
    businessId,
    languageCode,
    payload,
  });

  const updatedPanel = await updateBusinessPanelSection(businessId, payload);

  return jsonOk({
    data: {
      locale: languageCode,
      active,
      panel: updatedPanel,
    },
  });
}

async function handleSetDefaultAction(
  businessId: string,
  panel: Awaited<ReturnType<typeof getBusinessPanelData>>,
  body: Record<string, unknown> | null,
) {
  const languageCode = normalizeLanguageCode(toStringValue(body?.languageCode));

  console.info("business.translations.action", {
    action: "set_default_language",
    languageCode,
    businessId,
  });

  if (!languageCode) {
    return jsonError("invalid_locale", "Geçersiz dil kodu.", 422);
  }

  const existing = panel.locales.find((locale) => normalizeLanguageCode(locale.code) === languageCode);
  if (!existing) {
    return jsonError("locale_not_found", "Dil bulunamadı.", 422);
  }

  const updatedPanel = await updateBusinessPanelSection(businessId, {
    section: "seo",
    metaTitle: panel.seo.metaTitle,
    metaDescription: panel.seo.metaDescription,
    defaultLocale: languageCode,
    hreflangEnabled: panel.seo.hreflangEnabled,
  });

  await updateBusinessPanelSection(businessId, {
    section: "locale",
    action: "update",
    recordId: existing.id,
    code: languageCode,
    name: existing.name || getLanguageLabel(languageCode),
    active: true,
    published: existing.published ?? false,
    translationComplete: existing.translationComplete ?? false,
  });

  return jsonOk({
    data: {
      locale: languageCode,
      panel: updatedPanel,
    },
  });
}

async function handleTranslateAllActiveAction(
  businessId: string,
  panel: Awaited<ReturnType<typeof getBusinessPanelData>>,
  body: Record<string, unknown> | null,
) {
  const activeLocales = panel.locales.filter((locale) => locale.active);
  const sourceLocale = normalizeLanguageCode(toStringValue(body?.sourceLocale)) ?? "tr";
  const drafts = [];

  console.info("business.translations.action", {
    action: "translate_all_active",
    languageCode: activeLocales.map((locale) => locale.code).join(","),
    businessId,
  });

  for (const locale of activeLocales) {
    const languageCode = normalizeLanguageCode(locale.code);
    if (!languageCode) {
      continue;
    }

    const sectionDrafts = await handleTranslateAction(businessId, panel, {
      section: "all",
      targetLocale: languageCode,
      sourceLocale,
    });

    if (!sectionDrafts.ok) {
      return sectionDrafts;
    }

    const payload = (await sectionDrafts.json().catch(() => null)) as
      | { data?: { drafts?: Array<unknown> } }
      | null;
    drafts.push(...(payload?.data?.drafts ?? []));
  }

  return jsonOk({
    data: {
      draftCount: drafts.length,
      activeLocales: activeLocales.map((locale) => locale.code),
    },
  });
}

async function handleBusinessTranslations(request: Request, mode: "POST" | "PATCH") {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return jsonError("unauthorized", auth.error, auth.status);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action =
    mode === "POST"
      ? ("translate_language" as ActionName)
      : (toStringValue(body?.action) as ActionName);

  const panel = await getBusinessPanelData(auth.session.businessId);

  try {
    if (mode === "POST") {
      return await handleTranslateAction(auth.session.businessId, panel, {
        ...body,
        section: "all",
        targetLocale: body?.languageCode ?? body?.targetLocale,
      });
    }

    if (action === "toggle_language") {
      return await handleToggleLanguageAction(auth.session.businessId, panel, body);
    }

    if (action === "set_default_language") {
      return await handleSetDefaultAction(auth.session.businessId, panel, body);
    }

    if (action === "translate_language") {
      return await handleTranslateAction(auth.session.businessId, panel, {
        ...body,
        section: body?.section ?? "all",
        targetLocale: body?.languageCode ?? body?.targetLocale,
      });
    }

    if (action === "translate_all_active") {
      return await handleTranslateAllActiveAction(auth.session.businessId, panel, body);
    }

    return jsonError("unsupported_action", "Desteklenmeyen işlem.", 400);
  } catch (error) {
    return mapActionError(error);
  }
}

export async function GET() {
  const auth = await requireApiBusinessSession();

  if (!auth.ok) {
    return jsonError("unauthorized", auth.error, auth.status);
  }

  const panel = await getBusinessPanelData(auth.session.businessId);
  return jsonOk({ panel });
}

export async function POST(request: Request) {
  return handleBusinessTranslations(request, "POST");
}

export async function PATCH(request: Request) {
  return handleBusinessTranslations(request, "PATCH");
}

