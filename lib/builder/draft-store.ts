import "server-only";

import { Buffer } from "node:buffer";
import {
  createBuilderDraftPersistenceRecord,
  createInitialBuilderDocumentState,
  type BuilderDraftPersistenceRecord,
  type BuilderVersionState,
} from "@/lib/builder/document-state";
import { getBlockDefinition } from "@/lib/builder/registry";
import { asBlockKey, asVariantKey } from "@/lib/builder/types";
import { normalizePageKey, type WorkspacePage, type WorkspaceSnapshot } from "@/lib/builder/workspace-state";
import { readBoolean, readEnum, readNumber, readString } from "@/lib/builder/validation";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import type {
  BlockValidationInput,
  BuilderValidationIssue,
  BuilderValidationResult,
  JsonRecord,
} from "@/lib/builder/types";

export class BuilderDraftConflictError extends Error {
  currentVersion: number;

  constructor(currentVersion: number) {
    super("draft_conflict");
    this.name = "BuilderDraftConflictError";
    this.currentVersion = currentVersion;
  }
}

export class BuilderDraftValidationError extends Error {
  issues: BuilderValidationIssue[];

  constructor(message: string, issues: BuilderValidationIssue[]) {
    super(message);
    this.name = "BuilderDraftValidationError";
    this.issues = issues;
  }
}

export type BuilderDraftServerRecord = {
  id: string;
  businessId: string;
  draftVersion: number;
  basePublishedVersion: number;
  document: BuilderDraftPersistenceRecord;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

export type BuilderDraftValidationResult = {
  valid: boolean;
  issues: BuilderValidationIssue[];
  document: BuilderDraftPersistenceRecord | null;
};

const DRAFT_TABLE = "/business_site_builder_drafts";
const MAX_DRAFT_PAGES = 20;
const MAX_SECTIONS_PER_PAGE = 50;
const MAX_DOCUMENT_BYTES = 1_000_000;
const SYSTEM_PAGE_KEYS_BY_ID: Record<string, string> = {
  "page-home": "home",
  "page-services": "services",
  "page-vehicles": "vehicles",
  "page-routes": "routes",
  "page-blog": "blog",
  "page-contact": "contact",
};
const RESERVED_PAGE_KEYS = new Set(Object.values(SYSTEM_PAGE_KEYS_BY_ID));

function humanizeKey(key: string): string {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

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

function nowIso() {
  return new Date().toISOString();
}

function readRowsFromResponseText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [] as Array<Record<string, unknown>>;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed as Array<Record<string, unknown>>;
    }

    if (parsed && typeof parsed === "object") {
      return [parsed as Record<string, unknown>];
    }

    return [] as Array<Record<string, unknown>>;
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response) {
    return [] as Array<Record<string, unknown>>;
  }

  const text = await response.text().catch(() => "");
  return response.ok ? readRowsFromResponseText(text) : [];
}

function mapDraftRow(row: Record<string, unknown>): BuilderDraftServerRecord | null {
  const businessId = typeof row.business_id === "string" ? row.business_id : "";
  const id = typeof row.id === "string" ? row.id : "";
  const updatedBy = typeof row.updated_by === "string" ? row.updated_by : null;
  const draftVersion = typeof row.draft_version === "number" ? row.draft_version : Number(row.draft_version);
  const basePublishedVersion =
    typeof row.base_published_version === "number" ? row.base_published_version : Number(row.base_published_version);
  const document = validateBuilderDraftDocument(row.document).document;

  if (!id || !businessId || !Number.isInteger(draftVersion) || draftVersion < 1 || !Number.isInteger(basePublishedVersion) || basePublishedVersion < 1 || !document) {
    return null;
  }

  return {
    id,
    businessId,
    draftVersion,
    basePublishedVersion,
    document: {
      ...document,
      version: {
        draft: draftVersion,
        published: basePublishedVersion,
        saved: draftVersion,
      },
      savedAt: typeof row.updated_at === "string" && row.updated_at ? row.updated_at : document.savedAt,
    },
    createdAt: typeof row.created_at === "string" ? row.created_at : document.savedAt,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : document.savedAt,
    updatedBy,
  };
}

function normalizeDraftDocument(
  document: BuilderDraftPersistenceRecord,
  draftVersion: number,
  basePublishedVersion: number,
  savedAt: string,
): BuilderDraftPersistenceRecord {
  return {
    version: {
      draft: draftVersion,
      published: basePublishedVersion,
      saved: draftVersion,
    },
    savedAt,
    workspace: structuredClone(document.workspace),
  };
}

function buildInitialDraftRecord() {
  const state = createInitialBuilderDocumentState();
  return createBuilderDraftPersistenceRecord(state, nowIso());
}

function parsePositiveInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  return null;
}

function parseNonNegativeInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  return null;
}

function hasUnsafeString(value: string) {
  const lower = value.toLowerCase();
  return (
    lower.includes("<script") ||
    lower.includes("</script") ||
    lower.includes("javascript:") ||
    lower.includes("expression(") ||
    lower.includes("url(javascript:")
  );
}

function collectUnsafeStrings(value: unknown, path: string, issues: BuilderValidationIssue[]) {
  if (typeof value === "string") {
    if (hasUnsafeString(value)) {
      issues.push({ path, message: "Guvensiz HTML/CSS veya javascript icerigi reddedildi." });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUnsafeStrings(item, `${path}[${index}]`, issues));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    collectUnsafeStrings(nested, path ? `${path}.${key}` : key, issues);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidVariantKey(definitionKey: string, variantKey: string) {
  const definition = getBlockDefinition(definitionKey as never);
  return Boolean(definition?.variants.some((variant) => String(variant.key) === variantKey));
}

// Gelen (client) page metadata'sini normalize eder. Kural: yalnizca GECERSIZ
// alanlar fallback'e duser (issue kaydiyla birlikte); GECERLI gelen degerler
// oldugu gibi korunur. Onceki hatali davranis, bu fonksiyonun donus degerini
// hic kullanmadan zaten hardcode edilmis (ve bu yuzden hep "gecerli" sayilan)
// degerleri tekrar dogrulamakti — boylece title/description/seoTitleHint/
// seoDescriptionHint her save'de sessizce siliniyordu. Artik donen deger
// dogrudan persist edilen page nesnesini olusturmak icin kullanilir.
function validatePageSettings(
  rawPage: Record<string, unknown>,
  pageId: string,
  key: string,
  isSystemPage: boolean,
  index: number,
  issues: BuilderValidationIssue[],
) {
  const expectedSystemKey = SYSTEM_PAGE_KEYS_BY_ID[pageId];

  if (isSystemPage) {
    if (!expectedSystemKey) {
      issues.push({ path: `workspace.pages[${index}]`, message: "System page id taninmadi." });
    } else if (key !== expectedSystemKey) {
      issues.push({ path: `workspace.pages[${index}].key`, message: "System page key kilitlidir." });
    }
  } else if (RESERVED_PAGE_KEYS.has(key)) {
    issues.push({ path: `workspace.pages[${index}].key`, message: "Rezerv sayfa anahtari kullanilamaz." });
  }

  const titleFallback = humanizeKey(key) || `Page ${index + 1}`;
  const title =
    readString(rawPage.title, titleFallback, `workspace.pages[${index}].title`, issues, { maxLength: 120 }) ||
    titleFallback;
  const description = readString(rawPage.description, "", `workspace.pages[${index}].description`, issues, {
    maxLength: 240,
  });
  const seoTitleHint = readString(rawPage.seoTitleHint, "", `workspace.pages[${index}].seoTitleHint`, issues, {
    maxLength: 180,
  });
  const seoDescriptionHint = readString(
    rawPage.seoDescriptionHint,
    "",
    `workspace.pages[${index}].seoDescriptionHint`,
    issues,
    { maxLength: 240 },
  );
  const containerWidth = readEnum(
    rawPage.containerWidth,
    ["sm", "md", "lg", "xl", "full"] as const,
    "lg",
    `workspace.pages[${index}].containerWidth`,
    issues,
  );
  const backgroundMode = readEnum(
    rawPage.backgroundMode,
    ["light", "soft", "dark"] as const,
    "light",
    `workspace.pages[${index}].backgroundMode`,
    issues,
  );
  const sectionGap = readNumber(rawPage.sectionGap, 24, `workspace.pages[${index}].sectionGap`, issues, {
    min: 0,
    max: 96,
  });
  const topSpacing = readNumber(rawPage.topSpacing, 24, `workspace.pages[${index}].topSpacing`, issues, {
    min: 0,
    max: 160,
  });
  const bottomSpacing = readNumber(rawPage.bottomSpacing, 40, `workspace.pages[${index}].bottomSpacing`, issues, {
    min: 0,
    max: 160,
  });
  const active = readBoolean(rawPage.active, true);

  return {
    title,
    description,
    seoTitleHint,
    seoDescriptionHint,
    containerWidth,
    backgroundMode,
    sectionGap,
    topSpacing,
    bottomSpacing,
    active,
  };
}

function validateSection(
  section: Record<string, unknown>,
  pageIndex: number,
  sectionIndex: number,
  issues: BuilderValidationIssue[],
) {
  const path = `workspace.pages[${pageIndex}].sections[${sectionIndex}]`;
  const blockKey = typeof section.blockKey === "string" ? section.blockKey : "";
  const definition = blockKey ? getBlockDefinition(blockKey as never) : undefined;
  const variantKey = typeof section.variantKey === "string" ? section.variantKey : "";
  const position = parseNonNegativeInteger(section.position);
  const active = typeof section.active === "boolean" ? section.active : null;

  if (!blockKey) {
    issues.push({ path: `${path}.blockKey`, message: "Block key bos olamaz." });
    return null;
  }

  if (!definition) {
    issues.push({ path: `${path}.blockKey`, message: "Registry'de blok bulunamadi." });
    return null;
  }

  if (!variantKey || !isValidVariantKey(blockKey, variantKey)) {
    issues.push({ path: `${path}.variantKey`, message: "Gecersiz variant." });
  }

  if (position === null) {
    issues.push({ path: `${path}.position`, message: "Pozisyon 0'dan buyuk tamsayi olmali." });
  }

  if (active === null) {
    issues.push({ path: `${path}.active`, message: "Active alanı boolean olmali." });
  }

  const validation = definition.validate({
    variantKey: variantKey as never,
    content: isRecord(section.content) ? section.content : {},
    style: isRecord(section.style) ? section.style : {},
    responsive: isRecord(section.responsive) ? section.responsive : {},
  }) as BuilderValidationResult;

  validation.issues.forEach((issue) => {
    issues.push({ path: `${path}.${issue.path}`, message: issue.message });
  });

  collectUnsafeStrings(validation.content, `${path}.content`, issues);
  collectUnsafeStrings(validation.style, `${path}.style`, issues);
  collectUnsafeStrings(isRecord(section.responsive) ? section.responsive : {}, `${path}.responsive`, issues);

  return {
    id: typeof section.id === "string" ? section.id.trim() : "",
    blockKey: asBlockKey(blockKey),
    variantKey: asVariantKey(variantKey),
    position: position ?? 0,
    active: active ?? true,
    content: validation.content,
    style: validation.style,
    responsive: isRecord(section.responsive) ? structuredClone(section.responsive) : {},
  };
}

function validateWorkspaceSnapshot(snapshot: unknown): BuilderDraftValidationResult {
  const issues: BuilderValidationIssue[] = [];

  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, issues: [{ path: "workspace", message: "Workspace snapshot bekleniyor." }], document: null };
  }

  const workspace = snapshot as WorkspaceSnapshot & { pages?: unknown; selectedPageId?: unknown; selectedSectionByPageId?: unknown };
  const pages = Array.isArray(workspace.pages) ? workspace.pages : null;

  if (!pages) {
    issues.push({ path: "workspace.pages", message: "Pages dizisi bekleniyor." });
    return { valid: false, issues, document: null };
  }

  if (pages.length === 0) {
    issues.push({ path: "workspace.pages", message: "En az bir page gerekli." });
  }

  if (pages.length > MAX_DRAFT_PAGES) {
    issues.push({ path: "workspace.pages", message: `En fazla ${MAX_DRAFT_PAGES} page olabilir.` });
  }

  const pageKeySet = new Set<string>();
  const sectionIdSet = new Set<string>();
  const normalizedPages: WorkspacePage[] = [];

  pages.forEach((rawPage, pageIndex) => {
    if (!isRecord(rawPage)) {
      issues.push({ path: `workspace.pages[${pageIndex}]`, message: "Page nesnesi bekleniyor." });
      return;
    }

    const pageId = typeof rawPage.id === "string" ? rawPage.id.trim() : "";
    if (!pageId) {
      issues.push({ path: `workspace.pages[${pageIndex}].id`, message: "Page id bos olamaz." });
    }

    const key = normalizePageKey(typeof rawPage.key === "string" ? rawPage.key : "");
    if (!key) {
      issues.push({ path: `workspace.pages[${pageIndex}].key`, message: "Page key bos olamaz." });
    } else if (pageKeySet.has(key)) {
      issues.push({ path: `workspace.pages[${pageIndex}].key`, message: "Duplicate page key." });
    } else {
      pageKeySet.add(key);
    }

    const sectionRows = Array.isArray(rawPage.sections) ? rawPage.sections : null;
    if (!sectionRows) {
      issues.push({ path: `workspace.pages[${pageIndex}].sections`, message: "Sections dizisi bekleniyor." });
      return;
    }

    if (sectionRows.length > MAX_SECTIONS_PER_PAGE) {
      issues.push({ path: `workspace.pages[${pageIndex}].sections`, message: `En fazla ${MAX_SECTIONS_PER_PAGE} section olabilir.` });
    }

    const sectionPositionSet = new Set<number>();
    const normalizedSections = [] as WorkspacePage["sections"];

    sectionRows.forEach((rawSection, sectionIndex) => {
      if (!isRecord(rawSection)) {
        issues.push({ path: `workspace.pages[${pageIndex}].sections[${sectionIndex}]`, message: "Section nesnesi bekleniyor." });
        return;
      }

      const normalizedSection = validateSection(rawSection, pageIndex, sectionIndex, issues);
      if (!normalizedSection) {
        return;
      }

      if (!normalizedSection.id) {
        issues.push({ path: `workspace.pages[${pageIndex}].sections[${sectionIndex}].id`, message: "Section id bos olamaz." });
      } else if (sectionIdSet.has(normalizedSection.id)) {
        issues.push({ path: `workspace.pages[${pageIndex}].sections[${sectionIndex}].id`, message: "Duplicate section id." });
      } else {
        sectionIdSet.add(normalizedSection.id);
      }

      if (sectionPositionSet.has(normalizedSection.position)) {
        issues.push({ path: `workspace.pages[${pageIndex}].sections[${sectionIndex}].position`, message: "Duplicate section position." });
      } else {
        sectionPositionSet.add(normalizedSection.position);
      }

      normalizedSections.push(normalizedSection);
    });

    if (normalizedSections.length && normalizedSections.some((section, index) => section.position !== index)) {
      issues.push({ path: `workspace.pages[${pageIndex}].sections`, message: "Section sirasi normalize edilmemis." });
    }

    const resolvedPageId = pageId || `page-${pageIndex}`;
    const resolvedKey = key || "";
    const isSystemPage = resolvedPageId in SYSTEM_PAGE_KEYS_BY_ID;
    const settings = validatePageSettings(rawPage, resolvedPageId, resolvedKey, isSystemPage, pageIndex, issues);

    normalizedPages.push({
      id: resolvedPageId,
      key: resolvedKey,
      title: settings.title,
      description: settings.description,
      seoTitleHint: settings.seoTitleHint,
      seoDescriptionHint: settings.seoDescriptionHint,
      isSystemPage,
      active: settings.active,
      containerWidth: settings.containerWidth,
      backgroundMode: settings.backgroundMode,
      sectionGap: settings.sectionGap,
      topSpacing: settings.topSpacing,
      bottomSpacing: settings.bottomSpacing,
      sections: normalizedSections,
    });
  });

  // Selection (selectedPageId / selectedSectionByPageId) sadece UI-icin bir
  // "hangi sayfa/section acik" isaretcisidir; icerigin gecerliligini
  // ETKILEMEMELI. Bu yuzden hicbir zaman `issues`'a eklenmez ve save'i
  // reddetmez — gecersiz/stale bir referans sessizce ilk gecerli degere
  // (ilk page, ilk section) sifirlanir.
  const rawSelectedPageId = typeof workspace.selectedPageId === "string" ? workspace.selectedPageId : "";
  const selectedPageId = normalizedPages.some((page) => page.id === rawSelectedPageId)
    ? rawSelectedPageId
    : normalizedPages[0]?.id ?? "";

  const rawSelectedSectionByPageId = isRecord(workspace.selectedSectionByPageId)
    ? (workspace.selectedSectionByPageId as Record<string, unknown>)
    : {};
  const selectedSectionByPageId: Record<string, string | null> = {};
  for (const page of normalizedPages) {
    const candidate = rawSelectedSectionByPageId[page.id];
    const isValidCandidate =
      typeof candidate === "string" && page.sections.some((section) => section.id === candidate);
    selectedSectionByPageId[page.id] = isValidCandidate ? (candidate as string) : page.sections[0]?.id ?? null;
  }

  const normalizedWorkspace = {
    pages: normalizedPages,
    selectedPageId,
    selectedSectionByPageId,
  } satisfies WorkspaceSnapshot;

  const workspaceRecord = workspace as unknown as Record<string, unknown>;
  const workspaceVersionRecord = isRecord(workspaceRecord.version) ? workspaceRecord.version : {};
  const document: BuilderDraftPersistenceRecord = {
    version: {
      draft: parsePositiveInteger(workspaceVersionRecord.draft) ?? 1,
      published: parsePositiveInteger(workspaceVersionRecord.published) ?? 1,
      saved: parsePositiveInteger(workspaceVersionRecord.saved) ?? 1,
    } satisfies BuilderVersionState,
    savedAt: typeof workspaceRecord.savedAt === "string"
      ? String(workspaceRecord.savedAt)
      : nowIso(),
    workspace: normalizedWorkspace,
  };

  const rawDocumentJson = JSON.stringify(document);
  if (Buffer.byteLength(rawDocumentJson, "utf8") > MAX_DOCUMENT_BYTES) {
    issues.push({ path: "document", message: `Dokuman boyutu en fazla ${MAX_DOCUMENT_BYTES} byte olabilir.` });
  }

  return {
    valid: issues.length === 0,
    issues,
    document: issues.length === 0 ? document : null,
  };
}

export function validateBuilderDraftDocument(value: unknown): BuilderDraftValidationResult {
  if (!value || typeof value !== "object") {
    return { valid: false, issues: [{ path: "document", message: "Draft dokumenti bekleniyor." }], document: null };
  }

  const record = value as Record<string, unknown>;
  if (!isRecord(record.version) || typeof record.savedAt !== "string" || !record.workspace) {
    return { valid: false, issues: [{ path: "document", message: "Draft dokumenti gecersiz." }], document: null };
  }

  const workspaceValidation = validateWorkspaceSnapshot(record.workspace);
  if (!workspaceValidation.valid || !workspaceValidation.document) {
    return workspaceValidation;
  }

  const version = {
    draft: parsePositiveInteger(record.version.draft) ?? 1,
    published: parsePositiveInteger(record.version.published) ?? 1,
    saved: parsePositiveInteger(record.version.saved) ?? 1,
  } satisfies BuilderVersionState;

  return {
    valid: true,
    issues: [],
    document: {
      version,
      savedAt: record.savedAt,
      workspace: workspaceValidation.document.workspace,
    },
  };
}

async function readDraftRow(businessId: string) {
  const response = await supabaseFetch(
    `${DRAFT_TABLE}?select=id,business_id,draft_version,base_published_version,document,created_at,updated_at,updated_by&business_id=eq.${encodeURIComponent(
      businessId,
    )}&limit=1`,
  );

  if (!response) {
    return null;
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));
  return rows[0] ?? null;
}

export async function getBusinessBuilderDraft(businessId: string) {
  if (!businessId.trim()) {
    return null;
  }

  const existing = await readDraftRow(businessId);
  if (existing) {
    const mapped = mapDraftRow(existing);
    if (mapped) {
      return mapped;
    }

    // Satir var ama document/draft_version/base_published_version bozuk
    // (malformed jsonb, gecersiz versiyon vb). Bu satiri INSERT ile tekrar
    // olusturmaya calismak business_id unique kisitlamasina her zaman
    // carpar (409) ve GET sonsuza kadar 500 dondururdu. Bunun yerine AYNI
    // satiri gecerli bir seed document ile onarir (repair), baska hicbir
    // tenant satirina dokunmaz.
    const rowId = typeof existing.id === "string" ? existing.id : "";
    if (rowId) {
      return repairBusinessBuilderDraft(businessId, rowId);
    }
  }

  return createBusinessBuilderDraft(businessId);
}

export type BuilderDraftLookupResult =
  | { status: "ok"; record: BuilderDraftServerRecord }
  | { status: "not_found" }
  | { status: "malformed" };

// Publish akisi icin: getBusinessBuilderDraft()'in aksine burasi HICBIR ZAMAN
// otomatik seed veya repair yapmaz. Publish, olmayan bir taslagi sessizce
// olusturup onu yayinlamamali; bozuk bir taslagi onarip yayinlamamali — her
// iki durum da publish-store tarafindan acikca reddedilmeli (422).
export async function readBusinessBuilderDraftForPublish(businessId: string): Promise<BuilderDraftLookupResult> {
  const trimmed = businessId.trim();
  if (!trimmed) {
    return { status: "not_found" };
  }

  const existing = await readDraftRow(trimmed);
  if (!existing) {
    return { status: "not_found" };
  }

  const mapped = mapDraftRow(existing);
  if (!mapped) {
    return { status: "malformed" };
  }

  return { status: "ok", record: mapped };
}

async function repairBusinessBuilderDraft(
  businessId: string,
  rowId: string,
): Promise<BuilderDraftServerRecord> {
  if (!hasSupabaseConnection()) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  // Corruption'i logla ama document/secret icerigini asla loglama.
  console.error("[builder-draft] corrupted draft row repaired", { businessId, rowId });

  const draft = buildInitialDraftRecord();
  const response = await supabaseFetch(`${DRAFT_TABLE}?id=eq.${encodeURIComponent(rowId)}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      draft_version: draft.version.draft,
      base_published_version: draft.version.published,
      document: draft,
      updated_by: null,
    }),
  });

  if (!response) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));
  const mapped = rows.length ? mapDraftRow(rows[0]) : null;

  if (response.ok && mapped) {
    return mapped;
  }

  // Repair PATCH'i 0 satir etkiledi (satir bu arada silindi olabilir) veya
  // yanit hala gecersiz — son bir kez taze satiri okuyup dene, yoksa fail.
  const freshRow = await readDraftRow(businessId);
  const freshMapped = freshRow ? mapDraftRow(freshRow) : null;
  if (freshMapped) {
    return freshMapped;
  }

  throw new Error("Bozuk builder draft onarilamadi.");
}

export async function createBusinessBuilderDraft(
  businessId: string,
  updatedBy: string | null = null,
): Promise<BuilderDraftServerRecord> {
  if (!hasSupabaseConnection()) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  const draft = buildInitialDraftRecord();
  const payload = {
    business_id: businessId,
    draft_version: draft.version.draft,
    base_published_version: draft.version.published,
    document: draft,
    updated_by: updatedBy,
  };

  const response = await supabaseFetch(DRAFT_TABLE, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  if (!response.ok) {
    if (response.status === 409) {
      const existing = await readDraftRow(businessId);
      const mapped = existing ? mapDraftRow(existing) : null;
      if (mapped) {
        return mapped;
      }
    }

    throw new Error("Builder draft olusturulamadi.");
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));
  const mapped = rows.length ? mapDraftRow(rows[0]) : null;
  if (!mapped) {
    throw new Error("Builder draft yaniti okunamadi.");
  }

  return mapped;
}

export async function saveBusinessBuilderDraft({
  businessId,
  document,
  expectedVersion,
  updatedBy = null,
}: {
  businessId: string;
  document: BuilderDraftPersistenceRecord;
  expectedVersion: number;
  updatedBy?: string | null;
}): Promise<BuilderDraftServerRecord> {
  const validation = validateBuilderDraftDocument(document);
  if (!validation.valid || !validation.document) {
    throw new BuilderDraftValidationError("draft_invalid", validation.issues);
  }

  const current = await readDraftRow(businessId);
  const currentVersion = parsePositiveInteger(current?.draft_version);
  if (currentVersion !== null && currentVersion !== expectedVersion) {
    throw new BuilderDraftConflictError(currentVersion);
  }

  const nextVersion = expectedVersion + 1;
  const savedAt = nowIso();
  const basePublishedVersion =
    parsePositiveInteger(current?.base_published_version) ??
    validation.document.version.published ??
    1;

  const normalizedDocument = normalizeDraftDocument(validation.document, nextVersion, basePublishedVersion, savedAt);

  if (!hasSupabaseConnection()) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  const response = await supabaseFetch(
    `${DRAFT_TABLE}?business_id=eq.${encodeURIComponent(businessId)}&draft_version=eq.${encodeURIComponent(String(expectedVersion))}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        draft_version: nextVersion,
        base_published_version: basePublishedVersion,
        document: normalizedDocument,
        updated_by: updatedBy,
      }),
    },
  );

  if (!response) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));
  const mapped = rows.length ? mapDraftRow(rows[0]) : null;

  if (response.ok && mapped) {
    return mapped;
  }

  const freshRow = await readDraftRow(businessId);
  const freshVersion = parsePositiveInteger(freshRow?.draft_version);
  throw new BuilderDraftConflictError(freshVersion ?? expectedVersion);
}

export async function resetBusinessBuilderDraft(
  businessId: string,
  updatedBy: string | null = null,
): Promise<BuilderDraftServerRecord> {
  if (!hasSupabaseConnection()) {
    throw new Error("Supabase baglantisi kurulamadı.");
  }

  const response = await supabaseFetch(
    `${DRAFT_TABLE}?business_id=eq.${encodeURIComponent(businessId)}`,
    {
      method: "DELETE",
    },
  );

  if (!response?.ok && response) {
    throw new Error("Builder draft sifirlanamadi.");
  }

  return createBusinessBuilderDraft(businessId, updatedBy);
}
