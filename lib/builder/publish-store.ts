import "server-only";

import {
  readBusinessBuilderDraftForPublish,
  validateBuilderDraftDocument,
} from "@/lib/builder/draft-store";
import type { BuilderDraftPersistenceRecord } from "@/lib/builder/document-state";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import type { BuilderValidationIssue } from "@/lib/builder/types";

// ============================================================
// Website Builder Faz 10 — publish pipeline + published snapshot okuma
// katmani. Draft dogrulama mantigi draft-store.ts'ten AYNEN yeniden
// kullanilir (validateBuilderDraftDocument) — iki ayri validation mantigi
// yok. Gercek atomiklik supabase/migrations/0046_stage8_site_builder_publication.sql
// icindeki publish_builder_draft/rollback_builder_publication Postgres
// fonksiyonlarindan gelir (tek RPC cagrisi = tek transaction); bu dosya
// yalnizca o RPC'leri cagirir ve sonuclarini/hatalarini tip-guvenli hale
// getirir.
// ============================================================

export class BuilderPublishNotFoundError extends Error {
  constructor() {
    super("draft_not_found");
    this.name = "BuilderPublishNotFoundError";
  }
}

export class BuilderPublishValidationError extends Error {
  issues: BuilderValidationIssue[];

  constructor(issues: BuilderValidationIssue[]) {
    super("publish_validation_failed");
    this.name = "BuilderPublishValidationError";
    this.issues = issues;
  }
}

export class BuilderPublishConflictError extends Error {
  kind: "draft" | "published";
  currentDraftVersion: number;
  currentPublishedVersion: number;

  constructor(kind: "draft" | "published", currentDraftVersion: number, currentPublishedVersion: number) {
    super(kind === "draft" ? "draft_conflict" : "published_conflict");
    this.name = "BuilderPublishConflictError";
    this.kind = kind;
    this.currentDraftVersion = currentDraftVersion;
    this.currentPublishedVersion = currentPublishedVersion;
  }
}

export class BuilderPublishTransactionError extends Error {
  constructor(message = "publish_transaction_failed") {
    super(message);
    this.name = "BuilderPublishTransactionError";
  }
}

export class BuilderRollbackNotFoundError extends Error {
  constructor() {
    super("target_revision_not_found");
    this.name = "BuilderRollbackNotFoundError";
  }
}

export type BuilderPublishResult = {
  revisionId: string;
  publishedVersion: number;
  draftVersion: number;
  publishedAt: string;
};

export type BuilderPublicationVersionSummary = {
  version: number;
  revisionId: string;
  status: string;
  source: string;
  createdAt: string;
  createdBy: string | null;
  hasBuilderDocument: boolean;
  isActive: boolean;
};

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

function readRowsFromResponseText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [] as Array<Record<string, unknown>>;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
  } catch {
    return [] as Array<Record<string, unknown>>;
  }
}

type PostgrestErrorBody = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

function parsePostgrestError(text: string): PostgrestErrorBody {
  try {
    return JSON.parse(text) as PostgrestErrorBody;
  } catch {
    return {};
  }
}

function parseConflictDetail(details: string | null | undefined) {
  if (!details) {
    return { currentDraftVersion: 0, currentPublishedVersion: 0 };
  }

  try {
    const parsed = JSON.parse(details) as { currentDraftVersion?: unknown; currentPublishedVersion?: unknown };
    return {
      currentDraftVersion: typeof parsed.currentDraftVersion === "number" ? parsed.currentDraftVersion : 0,
      currentPublishedVersion:
        typeof parsed.currentPublishedVersion === "number" ? parsed.currentPublishedVersion : 0,
    };
  } catch {
    return { currentDraftVersion: 0, currentPublishedVersion: 0 };
  }
}

function throwForPublishRpcError(text: string): never {
  const body = parsePostgrestError(text);

  if (body.message === "draft_not_found") {
    throw new BuilderPublishNotFoundError();
  }

  if (body.message === "draft_conflict" || body.message === "published_conflict") {
    const detail = parseConflictDetail(body.details);
    throw new BuilderPublishConflictError(
      body.message === "draft_conflict" ? "draft" : "published",
      detail.currentDraftVersion,
      detail.currentPublishedVersion,
    );
  }

  throw new BuilderPublishTransactionError(body.message || "Yayın işlemi başarısız.");
}

// Publish, draft-store'un save-time validation'inin AYNISINI publish anında
// tekrar calistirir (registry drift savunması — bir block/variant tanımı
// save'den sonra kaldırılmış/degismis olabilir). Draft satırının kendisi
// zaten her save'de valide edildigi icin normalde bu hicbir sey bulmaz;
// ama "server-side validation olmadan snapshot yazilmamali" ilkesini garanti
// eder ve gecersiz icerigi RPC'ye hic ulasmadan (revision/snapshot
// olusturmadan) 422 ile reddeder.
async function loadAndValidateDraftForPublish(businessId: string) {
  const lookup = await readBusinessBuilderDraftForPublish(businessId);

  if (lookup.status === "not_found") {
    throw new BuilderPublishNotFoundError();
  }

  if (lookup.status === "malformed") {
    throw new BuilderPublishValidationError([
      { path: "document", message: "Taslak dokümanı bozuk, yayınlanamaz." },
    ]);
  }

  const validation = validateBuilderDraftDocument(lookup.record.document);

  if (!validation.valid || !validation.document) {
    throw new BuilderPublishValidationError(validation.issues);
  }

  return lookup.record;
}

export async function publishBuilderDraft({
  businessId,
  expectedDraftVersion,
  expectedPublishedVersion,
  note = "Yayınlandı",
}: {
  businessId: string;
  expectedDraftVersion: number;
  expectedPublishedVersion: number;
  note?: string;
}): Promise<BuilderPublishResult> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    throw new BuilderPublishNotFoundError();
  }

  if (!hasSupabaseConnection()) {
    throw new BuilderPublishTransactionError("Supabase baglantisi kurulamadı.");
  }

  // Hizli-basarisiz-ol on-kontrolu: gecersiz/eksik draft icin RPC'yi hic
  // cagirma (gereksiz revision/snapshot denemesi yaratmaz). Asil atomik
  // guvence yine de RPC'nin kendi FOR UPDATE + version esitligi kontrolundedir
  // — bu on-kontrol yalnizca erken ve net bir 422 saglar.
  await loadAndValidateDraftForPublish(safeBusinessId);

  const response = await supabaseFetch("/rpc/publish_builder_draft", {
    method: "POST",
    body: JSON.stringify({
      p_business_id: safeBusinessId,
      p_expected_draft_version: expectedDraftVersion,
      p_expected_published_version: expectedPublishedVersion,
      p_note: note,
    }),
  });

  if (!response) {
    throw new BuilderPublishTransactionError("Supabase baglantisi kurulamadı.");
  }

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    throwForPublishRpcError(text);
  }

  const rows = readRowsFromResponseText(text);
  const row = rows[0];

  if (!row) {
    throw new BuilderPublishTransactionError("Yayın yanıtı okunamadı.");
  }

  return {
    revisionId: String(row.revision_id ?? ""),
    publishedVersion: Number(row.published_version ?? 0),
    draftVersion: Number(row.draft_version ?? 0),
    publishedAt: String(row.published_at ?? ""),
  };
}

export async function rollbackBuilderPublication(
  businessId: string,
  targetRevisionId: string,
  note = "Geri alındı",
): Promise<{ revisionId: string; publishedVersion: number; publishedAt: string }> {
  const safeBusinessId = businessId.trim();
  const safeTargetRevisionId = targetRevisionId.trim();

  if (!safeBusinessId || !safeTargetRevisionId) {
    throw new BuilderRollbackNotFoundError();
  }

  if (!hasSupabaseConnection()) {
    throw new BuilderPublishTransactionError("Supabase baglantisi kurulamadı.");
  }

  const response = await supabaseFetch("/rpc/rollback_builder_publication", {
    method: "POST",
    body: JSON.stringify({
      p_business_id: safeBusinessId,
      p_target_revision_id: safeTargetRevisionId,
      p_note: note,
    }),
  });

  if (!response) {
    throw new BuilderPublishTransactionError("Supabase baglantisi kurulamadı.");
  }

  const text = await response.text().catch(() => "");

  if (!response.ok) {
    const body = parsePostgrestError(text);
    if (body.message === "target_revision_not_found") {
      throw new BuilderRollbackNotFoundError();
    }
    throw new BuilderPublishTransactionError(body.message || "Geri alma işlemi başarısız.");
  }

  const rows = readRowsFromResponseText(text);
  const row = rows[0];

  if (!row) {
    throw new BuilderPublishTransactionError("Geri alma yanıtı okunamadı.");
  }

  return {
    revisionId: String(row.revision_id ?? ""),
    publishedVersion: Number(row.published_version ?? 0),
    publishedAt: String(row.published_at ?? ""),
  };
}

// ============================================================
// Published snapshot okuma katmani — tamamen tenant-scoped, draft'a asla
// fallback yapmaz (yayinlanmis bir surum yoksa null doner, boylece cagiran
// taraf "henuz yayinlanmadi" ile "draft'i goster" durumlarini karistiramaz).
// Bozuk bir snapshot satiri (beklenmeyen bicimde jsonb) public tarafi
// çökertmemesi icin sessizce atlanir/null donulur, throw edilmez.
// ============================================================

function readDocumentFromRow(row: Record<string, unknown> | undefined): BuilderDraftPersistenceRecord | null {
  if (!row || typeof row.document !== "object" || row.document === null) {
    return null;
  }

  try {
    return row.document as BuilderDraftPersistenceRecord;
  } catch {
    return null;
  }
}

export async function getPublishedBuilderDocument(
  businessId: string,
  revisionId?: string,
): Promise<BuilderDraftPersistenceRecord | null> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return null;
  }

  if (!hasSupabaseConnection()) {
    return null;
  }

  const query = revisionId
    ? `/business_publication_site_builder_documents?select=document&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&limit=1`
    : `/business_publication_site_builder_documents?select=document&business_id=eq.${encodeURIComponent(
        safeBusinessId,
      )}&order=document_version.desc&limit=1`;

  const response = await supabaseFetch(query);

  if (!response?.ok) {
    return null;
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));
  return readDocumentFromRow(rows[0]);
}

export async function getLatestPublishedBuilderDocument(
  businessId: string,
): Promise<BuilderDraftPersistenceRecord | null> {
  return getPublishedBuilderDocument(businessId);
}

export async function getBuilderPublicationVersion(
  businessId: string,
  version: number,
): Promise<BuilderDraftPersistenceRecord | null> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId || !Number.isInteger(version) || version <= 0) {
    return null;
  }

  if (!hasSupabaseConnection()) {
    return null;
  }

  const response = await supabaseFetch(
    `/business_publication_site_builder_documents?select=document&business_id=eq.${encodeURIComponent(
      safeBusinessId,
    )}&document_version=eq.${encodeURIComponent(String(version))}&limit=1`,
  );

  if (!response?.ok) {
    return null;
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));
  return readDocumentFromRow(rows[0]);
}

export async function listBuilderPublicationVersions(
  businessId: string,
): Promise<BuilderPublicationVersionSummary[]> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId || !hasSupabaseConnection()) {
    return [];
  }

  const response = await supabaseFetch(
    `/business_publication_site_builder_documents?select=revision_id,document_version,created_at,business_publication_revisions(status,source,created_at)&business_id=eq.${encodeURIComponent(
      safeBusinessId,
    )}&order=document_version.desc&limit=200`,
  );

  if (!response?.ok) {
    return [];
  }

  const rows = readRowsFromResponseText(await response.text().catch(() => ""));

  if (rows.length === 0) {
    return [];
  }

  const maxVersion = rows.reduce((max, row) => Math.max(max, Number(row.document_version ?? 0)), 0);

  // createdBy best-effort: audit_logs'ta bu revizyon icin bir builder_publish
  // kaydi varsa actor_user_id'yi al. Audit best-effort oldugu icin (bkz.
  // lib/audit.ts) burasi da hata durumunda sessizce null birakir.
  const auditByRevision = await readAuditActorsByRevision(
    safeBusinessId,
    rows.map((row) => String(row.revision_id ?? "")),
  );

  return rows.map((row) => {
    const revisionId = String(row.revision_id ?? "");
    const revisionRelation = row.business_publication_revisions as
      | { status?: string; source?: string; created_at?: string }
      | Array<{ status?: string; source?: string; created_at?: string }>
      | null;
    const revisionInfo = Array.isArray(revisionRelation) ? revisionRelation[0] : revisionRelation;
    const version = Number(row.document_version ?? 0);

    return {
      version,
      revisionId,
      status: String(revisionInfo?.status ?? "unknown"),
      source: String(revisionInfo?.source ?? "unknown"),
      createdAt: String(row.created_at ?? revisionInfo?.created_at ?? ""),
      createdBy: auditByRevision.get(revisionId) ?? null,
      hasBuilderDocument: true,
      isActive: version === maxVersion,
    } satisfies BuilderPublicationVersionSummary;
  });
}

async function readAuditActorsByRevision(businessId: string, revisionIds: string[]) {
  const map = new Map<string, string | null>();
  const uniqueIds = Array.from(new Set(revisionIds.filter(Boolean)));

  if (uniqueIds.length === 0 || !hasSupabaseConnection()) {
    return map;
  }

  try {
    const idList = uniqueIds.map((id) => `"${id}"`).join(",");
    const response = await supabaseFetch(
      `/audit_logs?select=entity_id,actor_user_id&business_id=eq.${encodeURIComponent(
        businessId,
      )}&entity_type=eq.builder_publication&entity_id=in.(${idList})`,
    );

    if (!response?.ok) {
      return map;
    }

    const rows = readRowsFromResponseText(await response.text().catch(() => ""));
    for (const row of rows) {
      const entityId = String(row.entity_id ?? "");
      if (entityId) {
        map.set(entityId, (row.actor_user_id as string | null) ?? null);
      }
    }
  } catch {
    // audit lookup best-effort — hata olursa createdBy null kalir.
  }

  return map;
}
