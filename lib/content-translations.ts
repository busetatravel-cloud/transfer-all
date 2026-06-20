import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import { normalizeLanguageCode, type SupportedLanguageCode } from "@/lib/languages";
import { DEFAULT_PUBLIC_COPY } from "@/lib/public-copy";
import {
  SECTION_FIELD_LABELS,
  TRANSLATION_SECTIONS,
  getSectionFieldOrder,
  type TranslationFieldKey,
  type TranslationSection,
} from "@/lib/translation-schema";

export type { TranslationFieldKey, TranslationSection };

export type TranslationDraftRecord = {
  id: string;
  businessId: string;
  localeCode: SupportedLanguageCode;
  section: TranslationSection;
  sourceId: string;
  fieldKey: TranslationFieldKey;
  sourceText: string;
  translatedText: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishedTranslationRecord = TranslationDraftRecord & {
  revisionId: string;
};

export type SectionTranslationSeed = {
  section: TranslationSection;
  sourceId: string;
  fieldKey: TranslationFieldKey;
  sourceText: string;
};

type DemoTranslationState = {
  drafts: TranslationDraftRecord[];
  publishedByRevision: Record<string, PublishedTranslationRecord[]>;
};

const demoTranslationStore = new Map<string, DemoTranslationState>();

function ensureDemoTranslationState(businessId: string) {
  const current = demoTranslationStore.get(businessId);

  if (current) {
    return current;
  }

  const state: DemoTranslationState = {
    drafts: [],
    publishedByRevision: {},
  };

  demoTranslationStore.set(businessId, state);
  return state;
}

export { SECTION_FIELD_LABELS, TRANSLATION_SECTIONS, getSectionFieldOrder };

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response) {
    return [];
  }

  const text = await response.text().catch(() => "");
  const rawText = text;

  if (!text.trim()) {
    if (!response.ok) {
      throw new Error(
        JSON.stringify({
          code: "supabase_error",
          message: "Supabase sorgusu başarısız.",
          status: response.status,
          rawText,
        }),
      );
    }

    return [];
  }

  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const message =
      typeof parsed === "string"
        ? parsed
        : parsed && typeof parsed === "object"
          ? String(
              (parsed as Record<string, unknown>).message ??
                (parsed as Record<string, unknown>).error ??
                (parsed as Record<string, unknown>).details ??
                (parsed as Record<string, unknown>).hint ??
                text,
            )
          : text;

    throw new Error(
      JSON.stringify({
        code: "supabase_error",
        message,
        status: response.status,
        rawText,
      }),
    );
  }

  return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
}

async function insertRow(path: string, payload: Record<string, unknown>) {
  const response = await supabaseFetch(path, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const text = await response?.text().catch(() => "") || "";
  let parsed: unknown = text;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  } else {
    parsed = [];
  }

  if (!response?.ok) {
    const message =
      typeof parsed === "string"
        ? parsed
        : parsed && typeof parsed === "object"
          ? String(
              (parsed as Record<string, unknown>).message ??
                (parsed as Record<string, unknown>).error ??
                (parsed as Record<string, unknown>).details ??
                (parsed as Record<string, unknown>).hint ??
                text,
            )
          : "Kayit olusturulamadi.";
    throw new Error(
      JSON.stringify({
        code: "supabase_error",
        message,
        status: response?.status ?? 500,
        rawText: text,
      }),
    );
  }

  const rows = Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  return rows[0] ?? null;
}

async function deleteRows(path: string) {
  const response = await supabaseFetch(path, {
    method: "DELETE",
  });

  const text = await response?.text().catch(() => "") || "";
  let parsed: unknown = text;
  if (text.trim()) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (!response?.ok) {
    const message =
      typeof parsed === "string"
        ? parsed
        : parsed && typeof parsed === "object"
          ? String(
              (parsed as Record<string, unknown>).message ??
                (parsed as Record<string, unknown>).error ??
                (parsed as Record<string, unknown>).details ??
                (parsed as Record<string, unknown>).hint ??
                text,
            )
          : "Kayitlar silinemedi.";
    throw new Error(
      JSON.stringify({
        code: "supabase_error",
        message,
        status: response?.status ?? 500,
        rawText: text,
      }),
    );
  }
}

function mapDraft(row: Record<string, unknown>): TranslationDraftRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    localeCode: normalizeLanguageCode(String(row.locale_code ?? "")) ?? "tr",
    section: String(row.section ?? "hero") as TranslationSection,
    sourceId: String(row.source_id ?? ""),
    fieldKey: String(row.field_key ?? "") as TranslationFieldKey,
    sourceText: String(row.source_text ?? ""),
    translatedText: String(row.translated_text ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapPublished(row: Record<string, unknown>): PublishedTranslationRecord {
  return {
    ...mapDraft(row),
    revisionId: String(row.revision_id ?? ""),
  };
}

export function getSectionLabel(section: TranslationSection) {
  return TRANSLATION_SECTIONS.find((item) => item.section === section)?.label ?? section;
}

export function getSectionDescription(section: TranslationSection) {
  return TRANSLATION_SECTIONS.find((item) => item.section === section)?.description ?? "";
}

export function getSectionSeeds(panel: {
  business?: { name: string } | null;
  profile: { heroTitle: string; heroSubtitle: string; heroButtonText: string };
  services: Array<{ id: string; title: string; description: string }>;
  vehicles: Array<{ id: string; title: string; description: string }>;
  routes: Array<{ id: string; title: string; description: string }>;
  blogs: Array<{ id: string; title: string; excerpt: string; content: string }>;
  seo: { metaTitle: string; metaDescription: string };
}) {
  return {
    company: [
      { section: "company", sourceId: "business", fieldKey: "name", sourceText: panel.business?.name ?? "" },
    ],
    hero: [
      { section: "hero", sourceId: "profile", fieldKey: "heroTitle", sourceText: panel.profile.heroTitle ?? "" },
      { section: "hero", sourceId: "profile", fieldKey: "heroSubtitle", sourceText: panel.profile.heroSubtitle ?? "" },
      { section: "hero", sourceId: "profile", fieldKey: "heroButtonText", sourceText: panel.profile.heroButtonText ?? "" },
    ],
    service: panel.services.flatMap((item) => [
      { section: "service", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "service", sourceId: item.id, fieldKey: "description", sourceText: item.description ?? "" },
    ]),
    vehicle: panel.vehicles.flatMap((item) => [
      { section: "vehicle", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "vehicle", sourceId: item.id, fieldKey: "description", sourceText: item.description ?? "" },
    ]),
    route: panel.routes.flatMap((item) => [
      { section: "route", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "route", sourceId: item.id, fieldKey: "description", sourceText: item.description ?? "" },
    ]),
    blog: panel.blogs.flatMap((item) => [
      { section: "blog", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "blog", sourceId: item.id, fieldKey: "excerpt", sourceText: item.excerpt ?? "" },
      { section: "blog", sourceId: item.id, fieldKey: "content", sourceText: item.content ?? "" },
    ]),
    seo: [
      { section: "seo", sourceId: "seo", fieldKey: "metaTitle", sourceText: panel.seo.metaTitle ?? "" },
      { section: "seo", sourceId: "seo", fieldKey: "metaDescription", sourceText: panel.seo.metaDescription ?? "" },
    ],
    menus: [
      { section: "menus", sourceId: "main", fieldKey: "home", sourceText: DEFAULT_PUBLIC_COPY.menus.home },
      { section: "menus", sourceId: "main", fieldKey: "services", sourceText: DEFAULT_PUBLIC_COPY.menus.services },
      { section: "menus", sourceId: "main", fieldKey: "vehicles", sourceText: DEFAULT_PUBLIC_COPY.menus.vehicles },
      { section: "menus", sourceId: "main", fieldKey: "routes", sourceText: DEFAULT_PUBLIC_COPY.menus.routes },
      { section: "menus", sourceId: "main", fieldKey: "blogLabel", sourceText: DEFAULT_PUBLIC_COPY.menus.blog },
      { section: "menus", sourceId: "main", fieldKey: "contact", sourceText: DEFAULT_PUBLIC_COPY.menus.contact },
      { section: "menus", sourceId: "main", fieldKey: "quote", sourceText: DEFAULT_PUBLIC_COPY.menus.quote },
      { section: "menus", sourceId: "main", fieldKey: "booking", sourceText: DEFAULT_PUBLIC_COPY.menus.booking },
      { section: "menus", sourceId: "main", fieldKey: "languages", sourceText: DEFAULT_PUBLIC_COPY.menus.languages },
    ],
    publicForm: [
      { section: "publicForm", sourceId: "contact-form", fieldKey: "title", sourceText: DEFAULT_PUBLIC_COPY.publicForm.title },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "description", sourceText: DEFAULT_PUBLIC_COPY.publicForm.description },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "customerName", sourceText: DEFAULT_PUBLIC_COPY.publicForm.customerName },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "phone", sourceText: DEFAULT_PUBLIC_COPY.publicForm.phone },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "email", sourceText: DEFAULT_PUBLIC_COPY.publicForm.email },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "message", sourceText: DEFAULT_PUBLIC_COPY.publicForm.message },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "submit", sourceText: DEFAULT_PUBLIC_COPY.publicForm.submit },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "sending", sourceText: DEFAULT_PUBLIC_COPY.publicForm.sending },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "success", sourceText: DEFAULT_PUBLIC_COPY.publicForm.success },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "error", sourceText: DEFAULT_PUBLIC_COPY.publicForm.error },
    ],
    voucher: [
      { section: "voucher", sourceId: "mail", fieldKey: "mailSubject", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailSubject },
      { section: "voucher", sourceId: "mail", fieldKey: "mailGreeting", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailGreeting },
      { section: "voucher", sourceId: "mail", fieldKey: "mailReservationNo", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailReservationNo },
      { section: "voucher", sourceId: "mail", fieldKey: "mailDateTime", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailDateTime },
      { section: "voucher", sourceId: "mail", fieldKey: "mailPhone", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailPhone },
      { section: "voucher", sourceId: "mail", fieldKey: "mailOrigin", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailOrigin },
      { section: "voucher", sourceId: "mail", fieldKey: "mailDestination", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailDestination },
      { section: "voucher", sourceId: "mail", fieldKey: "mailVoucherLink", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailVoucherLink },
      { section: "voucher", sourceId: "mail", fieldKey: "mailClosing", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailClosing },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappGreeting", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappGreeting },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappReady", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappReady },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappReservationNo", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappReservationNo },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappDateTime", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappDateTime },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappOriginDestination", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappOriginDestination },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappVoucher", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappVoucher },
    ],
    booking: [
      { section: "booking", sourceId: "search", fieldKey: "eyebrow", sourceText: DEFAULT_PUBLIC_COPY.booking.eyebrow },
      { section: "booking", sourceId: "search", fieldKey: "title", sourceText: DEFAULT_PUBLIC_COPY.booking.title },
      { section: "booking", sourceId: "search", fieldKey: "description", sourceText: DEFAULT_PUBLIC_COPY.booking.description },
      { section: "booking", sourceId: "search", fieldKey: "searchPlaceholder", sourceText: DEFAULT_PUBLIC_COPY.booking.searchPlaceholder },
      { section: "booking", sourceId: "search", fieldKey: "searchButton", sourceText: DEFAULT_PUBLIC_COPY.booking.searchButton },
      { section: "booking", sourceId: "result", fieldKey: "openVoucher", sourceText: DEFAULT_PUBLIC_COPY.booking.openVoucher },
      { section: "booking", sourceId: "result", fieldKey: "statusLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.statusLabel },
      { section: "booking", sourceId: "result", fieldKey: "paymentLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.paymentLabel },
      { section: "booking", sourceId: "result", fieldKey: "dateLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.dateLabel },
      { section: "booking", sourceId: "result", fieldKey: "timeLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.timeLabel },
      { section: "booking", sourceId: "result", fieldKey: "originLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.originLabel },
      { section: "booking", sourceId: "result", fieldKey: "destinationLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.destinationLabel },
      { section: "booking", sourceId: "result", fieldKey: "vehicleLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.vehicleLabel },
      { section: "booking", sourceId: "result", fieldKey: "pickupLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.pickupLabel },
      { section: "booking", sourceId: "result", fieldKey: "passengersLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.passengersLabel },
      { section: "booking", sourceId: "result", fieldKey: "notesLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.notesLabel },
      { section: "booking", sourceId: "empty", fieldKey: "waitingTitle", sourceText: DEFAULT_PUBLIC_COPY.booking.waitingTitle },
      { section: "booking", sourceId: "empty", fieldKey: "waitingDescription", sourceText: DEFAULT_PUBLIC_COPY.booking.waitingDescription },
      { section: "booking", sourceId: "empty", fieldKey: "noResultTitle", sourceText: DEFAULT_PUBLIC_COPY.booking.noResultTitle },
      { section: "booking", sourceId: "empty", fieldKey: "noResultDescription", sourceText: DEFAULT_PUBLIC_COPY.booking.noResultDescription },
      { section: "booking", sourceId: "empty", fieldKey: "reservationLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.reservationLabel },
    ],
  } satisfies Record<TranslationSection, SectionTranslationSeed[]>;
}

export async function readBusinessTranslationDrafts(businessId: string) {
  if (!hasSupabaseConnection()) {
    return ensureDemoTranslationState(businessId).drafts;
  }

  const rows = await readRows(
    `/business_content_translations?business_id=eq.${encodeURIComponent(businessId)}&order=updated_at.desc,created_at.desc`,
  );
  return rows.map(mapDraft);
}

export async function readBusinessPublishedTranslationsByRevision(
  businessId: string,
  revisionId: string,
) {
  if (!hasSupabaseConnection()) {
    return ensureDemoTranslationState(businessId).publishedByRevision[revisionId] ?? [];
  }

  const rows = await readRows(
    `/business_publication_translations?business_id=eq.${encodeURIComponent(
      businessId,
    )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=created_at.asc`,
  );
  return rows.map(mapPublished);
}

export async function replaceBusinessTranslationDrafts(
  businessId: string,
  localeCode: string,
  rows: Array<Omit<TranslationDraftRecord, "id" | "businessId" | "createdAt" | "updatedAt">>,
  section?: TranslationSection,
) {
  const normalizedLocale = normalizeLanguageCode(localeCode);
  if (!normalizedLocale) {
    throw new Error("Dil kodu geçersiz.");
  }

  if (!hasSupabaseConnection()) {
    const now = new Date().toISOString();
    const demoRows = rows.map((row) => ({
      id: randomUUID(),
      businessId,
      ...row,
      localeCode: normalizedLocale,
      createdAt: now,
      updatedAt: now,
    }));
    const state = ensureDemoTranslationState(businessId);
    state.drafts = [
      ...state.drafts.filter(
        (item) =>
          !(item.localeCode === normalizedLocale && (!section || item.section === section)),
      ),
      ...demoRows,
    ];
    demoTranslationStore.set(businessId, state);
    return demoRows;
  }

  const sectionFilter = section ? `&section=eq.${encodeURIComponent(section)}` : "";
  await deleteRows(
    `/business_content_translations?business_id=eq.${encodeURIComponent(
      businessId,
    )}&locale_code=eq.${encodeURIComponent(normalizedLocale)}${sectionFilter}`,
  );

  const createdAt = new Date().toISOString();
  const inserted: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    try {
      const created = await insertRow("/business_content_translations", {
        id: randomUUID(),
        business_id: businessId,
        locale_code: normalizedLocale,
        section: row.section,
        source_id: row.sourceId,
        field_key: row.fieldKey,
        source_text: row.sourceText,
        translated_text: row.translatedText,
        created_at: createdAt,
        updated_at: createdAt,
      });

      if (created) {
        inserted.push(created);
      }
    } catch (error) {
      const parsed =
        error instanceof Error && error.message.trim()
          ? (() => {
              try {
                return JSON.parse(error.message) as Record<string, unknown>;
              } catch {
                return null;
              }
            })()
          : null;

      throw new Error(
        JSON.stringify({
          code: "supabase_error",
          message:
            typeof parsed?.message === "string" && parsed.message.trim()
              ? parsed.message
              : "Çeviri taslağı kaydedilemedi.",
          status: Number(parsed?.status ?? 422),
          rawText:
            typeof parsed?.rawText === "string" && parsed.rawText.trim()
              ? parsed.rawText
              : error instanceof Error
                ? error.message
                : String(error ?? ""),
          languageCode: normalizedLocale,
          section: row.section,
          sourceId: row.sourceId,
          fieldKey: row.fieldKey,
        }),
      );
    }
  }

  return inserted.map(mapDraft);
}

export async function replacePublishedTranslationsForRevision(
  businessId: string,
  revisionId: string,
  rows: TranslationDraftRecord[],
) {
  if (!hasSupabaseConnection()) {
    const state = ensureDemoTranslationState(businessId);
    const demoRows = rows.map((row) => ({
      ...row,
      revisionId,
    }));
    state.publishedByRevision[revisionId] = demoRows;
    demoTranslationStore.set(businessId, state);
    return demoRows;
  }

  const createdAt = new Date().toISOString();
  const inserted = await Promise.all(
    rows.map((row) =>
      insertRow("/business_publication_translations", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        locale_code: row.localeCode,
        section: row.section,
        source_id: row.sourceId,
        field_key: row.fieldKey,
        source_text: row.sourceText,
        translated_text: row.translatedText,
        created_at: createdAt,
        updated_at: createdAt,
      }),
    ),
  );

  return inserted.map(mapPublished);
}

export function buildTranslationDraftLookup(rows: TranslationDraftRecord[]) {
  const lookup = new Map<string, TranslationDraftRecord>();

  for (const row of rows) {
    lookup.set(`${row.localeCode}:${row.section}:${row.sourceId}:${row.fieldKey}`, row);
  }

  return lookup;
}

