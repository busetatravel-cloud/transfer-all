import "server-only";

import { randomUUID } from "node:crypto";
import { getBusinessById, type BusinessRecord } from "@/lib/business";
import {
  getBusinessPanelData,
  type BusinessBlogRecord,
  type BusinessLocaleRecord,
  type BusinessPanelData,
  type BusinessProfileRecord,
  type BusinessRouteRecord,
  type BusinessSeoRecord,
  type BusinessServiceRecord,
  type BusinessVehicleRecord,
} from "@/lib/business-panel";
import {
  readBusinessTranslationDrafts,
  readBusinessPublishedTranslationsByRevision,
  replacePublishedTranslationsForRevision,
} from "@/lib/content-translations";
import type { BusinessMediaAssetRecord } from "@/lib/media";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type BusinessPublicationStatus = "draft" | "preview" | "published" | "archived";

export type BusinessPublicationRevisionRecord = {
  id: string;
  businessId: string;
  version: number;
  status: BusinessPublicationStatus;
  source: string;
  note: string;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
};

export type BusinessPublishingCenterData = {
  business: BusinessRecord | null;
  draftPanel: BusinessPanelData | null;
  currentRevision: BusinessPublicationRevisionRecord | null;
  publishedRevision: BusinessPublicationRevisionRecord | null;
  history: BusinessPublicationRevisionRecord[];
};

type DemoPublicationState = {
  revisions: BusinessPublicationRevisionRecord[];
  snapshots: Record<string, BusinessPanelData>;
};

const demoPublicationStore = new Map<string, DemoPublicationState>();

function nowIso() {
  return new Date().toISOString();
}

function clonePanel(panel: BusinessPanelData): BusinessPanelData {
  return typeof structuredClone === "function"
    ? structuredClone(panel)
    : (JSON.parse(JSON.stringify(panel)) as BusinessPanelData);
}

function getEmptyDraftPanel(businessId: string): BusinessPanelData {
  return {
    business: null,
    profile: {
      businessId,
      heroTitle: "",
      heroSubtitle: "",
      heroButtonText: "",
    },
    mediaAssets: [],
    customers: [],
    services: [],
    vehicles: [],
    routes: [],
    blogs: [],
    seo: {
      businessId,
      metaTitle: "",
      metaDescription: "",
      canonicalUrl: "",
      defaultLocale: "tr",
      hreflangEnabled: true,
    },
    locales: [],
    requests: [],
  };
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

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response?.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

async function insertRow(path: string, payload: Record<string, unknown>) {
  const response = await supabaseFetch(path, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response?.ok) {
    const message = response ? await response.text().catch(() => "") : "";
    throw new Error(message || "Yayin kaydi olusturulamadi.");
  }

  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mapRevision(row: Record<string, unknown>): BusinessPublicationRevisionRecord {
  const status = String(row.status ?? "archived") as BusinessPublicationStatus;

  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    version: Number(row.version ?? 0),
    status:
      status === "draft" || status === "preview" || status === "published" || status === "archived"
        ? status
        : "archived",
    source: String(row.source ?? "manual"),
    note: String(row.note ?? ""),
    createdAt: String(row.created_at ?? ""),
    publishedAt: (row.published_at as string | null) ?? null,
    archivedAt: (row.archived_at as string | null) ?? null,
  };
}

function mapBusiness(row: Record<string, unknown>): BusinessRecord {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: (row.phone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    logoUrl: (row.logo_url as string | null) ?? null,
    active: Boolean(row.active ?? false),
    planId: (row.plan_id as string | null) ?? null,
    packageName: (row.package_name as string | null) ?? null,
    packageStart: (row.package_start as string | null) ?? null,
    packageEnd: (row.package_end as string | null) ?? null,
    domain: (row.domain as string | null) ?? null,
    hostname: (row.hostname as string | null) ?? null,
    verificationToken: (row.verification_token as string | null) ?? null,
    verifiedAt: (row.verified_at as string | null) ?? null,
    activatedAt: (row.activated_at as string | null) ?? null,
    lastCheckedAt: (row.last_checked_at as string | null) ?? null,
    sslStatus: (row.ssl_status as BusinessRecord["sslStatus"]) ?? "pending",
    domainStatus: (row.domain_status as BusinessRecord["domainStatus"]) ?? "pending",
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapProfile(row: Record<string, unknown>, businessId: string): BusinessProfileRecord {
  return {
    businessId,
    heroTitle: String(row.hero_title ?? ""),
    heroSubtitle: String(row.hero_subtitle ?? ""),
    heroButtonText: String(row.hero_button_text ?? ""),
  };
}

function mapSeo(row: Record<string, unknown>, businessId: string): BusinessSeoRecord {
  return {
    businessId,
    metaTitle: String(row.meta_title ?? ""),
    metaDescription: String(row.meta_description ?? ""),
    canonicalUrl: String(row.canonical_url ?? ""),
    defaultLocale: String(row.default_locale ?? "tr"),
    hreflangEnabled: Boolean(row.hreflang_enabled ?? true),
  };
}

function mapService(row: Record<string, unknown>): BusinessServiceRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active ?? false),
  };
}

function mapVehicle(row: Record<string, unknown>): BusinessVehicleRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active ?? false),
  };
}

function mapRoute(row: Record<string, unknown>): BusinessRouteRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    slug: String(row.slug ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    active: Boolean(row.active ?? false),
  };
}

function mapBlog(row: Record<string, unknown>): BusinessBlogRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    excerpt: String(row.excerpt ?? ""),
    content: String(row.content ?? ""),
    published: Boolean(row.published ?? false),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapLocale(row: Record<string, unknown>): BusinessLocaleRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    active: Boolean(row.active ?? false),
    published: Boolean(row.published ?? false),
    translationComplete: Boolean(row.translation_complete ?? false),
  };
}

function mapMediaAsset(row: Record<string, unknown>): BusinessMediaAssetRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    kind: String(row.kind ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    storagePath: String(row.storage_path ?? ""),
    altText: String(row.alt_text ?? ""),
    metadata: null,
    status: (row.status as BusinessMediaAssetRecord["status"]) ?? "placeholder",
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function buildHistoryRows(rows: Array<Record<string, unknown>>) {
  return rows
    .map(mapRevision)
    .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt));
}

function ensureDemoState(businessId: string) {
  const current = demoPublicationStore.get(businessId);
  if (current) {
    return current;
  }

  const state: DemoPublicationState = {
    revisions: [],
    snapshots: {},
  };
  demoPublicationStore.set(businessId, state);
  return state;
}

function storeDemoSnapshot(
  businessId: string,
  revision: BusinessPublicationRevisionRecord,
  panel: BusinessPanelData,
) {
  const state = ensureDemoState(businessId);
  state.revisions = state.revisions.filter((item) => item.id !== revision.id);
  state.revisions.push(revision);
  state.snapshots[revision.id] = clonePanel(panel);
  demoPublicationStore.set(businessId, state);
}

function getDemoPublishedPanel(businessId: string) {
  const state = demoPublicationStore.get(businessId);
  if (!state) {
    return null;
  }

  const revision =
    state.revisions
      .slice()
      .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt))
      .find((item) => item.status === "published") ?? null;

  if (!revision) {
    return null;
  }

  return state.snapshots[revision.id] ?? null;
}

async function readLatestPublishedRevision(businessId: string) {
  const rows = await readRows(
    `/business_publication_revisions?select=id,business_id,version,status,source,note,created_at,published_at,archived_at&business_id=eq.${encodeURIComponent(
      businessId,
    )}&order=version.desc,created_at.desc&limit=20`,
  );

  const revisions = buildHistoryRows(rows);
  return revisions.find((row) => row.status === "published") ?? null;
}

async function readLatestRevision(businessId: string) {
  const rows = await readRows(
    `/business_publication_revisions?select=id,business_id,version,status,source,note,created_at,published_at,archived_at&business_id=eq.${encodeURIComponent(
      businessId,
    )}&order=version.desc,created_at.desc&limit=50`,
  );

  return buildHistoryRows(rows);
}

async function readPublishedPanelFromRevision(businessId: string, revisionId: string) {
  const [
    businessRows,
    profileRows,
    mediaRows,
    serviceRows,
    vehicleRows,
    routeRows,
    blogRows,
    seoRows,
    localeRows,
  ] = await Promise.all([
    readRows(
      `/business_publication_businesses?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&limit=1`,
    ),
    readRows(
      `/business_publication_profiles?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&limit=1`,
    ),
    readRows(
      `/business_publication_media_assets?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=sort_order.asc,created_at.asc`,
    ),
    readRows(
      `/business_publication_services?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=sort_order.asc,created_at.asc`,
    ),
    readRows(
      `/business_publication_vehicles?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=sort_order.asc,created_at.asc`,
    ),
    readRows(
      `/business_publication_routes?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=sort_order.asc,created_at.asc`,
    ),
    readRows(
      `/business_publication_blog_posts?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=sort_order.asc,created_at.asc`,
    ),
    readRows(
      `/business_publication_seo?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&limit=1`,
    ),
    readRows(
      `/business_publication_locales?select=*&business_id=eq.${encodeURIComponent(
        businessId,
      )}&revision_id=eq.${encodeURIComponent(revisionId)}&order=created_at.asc`,
    ),
  ]);

  const business = businessRows[0] ? mapBusiness(businessRows[0]) : null;

  if (!business) {
    return null;
  }

  return {
    business,
    profile: profileRows[0] ? mapProfile(profileRows[0], businessId) : getEmptyDraftPanel(businessId).profile,
    mediaAssets: mediaRows.map(mapMediaAsset),
    customers: [],
    services: serviceRows.map(mapService),
    vehicles: vehicleRows.map(mapVehicle),
    routes: routeRows.map(mapRoute),
    blogs: blogRows.map(mapBlog),
    seo: seoRows[0] ? mapSeo(seoRows[0], businessId) : getEmptyDraftPanel(businessId).seo,
    locales: localeRows.map(mapLocale),
    requests: [],
  } satisfies BusinessPanelData;
}

async function insertPublishedSnapshot(businessId: string, revisionId: string, panel: BusinessPanelData) {
  if (!hasSupabaseConnection()) {
    return;
  }

  const now = nowIso();
  const business = panel.business ?? (await getBusinessById(businessId));

  if (!business) {
    throw new Error("Business bulunamadi.");
  }

  await Promise.all([
    insertRow("/business_publication_businesses", {
      id: randomUUID(),
      business_id: businessId,
      revision_id: revisionId,
      name: business.name,
      email: business.email,
      phone: business.phone,
      whatsapp: business.whatsapp,
      logo_url: business.logoUrl,
      active: business.active,
      package_name: business.packageName,
      package_start: business.packageStart,
      package_end: business.packageEnd,
      domain: business.domain,
      domain_status: business.domainStatus,
      created_at: business.createdAt || now,
      updated_at: business.updatedAt || now,
    }),
    insertRow("/business_publication_profiles", {
      id: randomUUID(),
      business_id: businessId,
      revision_id: revisionId,
      hero_title: panel.profile.heroTitle,
      hero_subtitle: panel.profile.heroSubtitle,
      hero_button_text: panel.profile.heroButtonText,
      created_at: now,
      updated_at: now,
    }),
    ...panel.mediaAssets.map((item) =>
      insertRow("/business_publication_media_assets", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        source_id: item.id,
        kind: item.kind,
        source_url: item.sourceUrl,
        storage_path: item.storagePath,
        alt_text: item.altText,
        status: item.status,
        sort_order: item.sortOrder,
        created_at: item.createdAt || now,
        updated_at: item.updatedAt || now,
      }),
    ),
    ...panel.services.map((item) =>
      insertRow("/business_publication_services", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        source_id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        sort_order: item.sortOrder,
        active: item.active,
        created_at: now,
        updated_at: now,
      }),
    ),
    ...panel.vehicles.map((item) =>
      insertRow("/business_publication_vehicles", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        source_id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        sort_order: item.sortOrder,
        active: item.active,
        created_at: now,
        updated_at: now,
      }),
    ),
    ...panel.routes.map((item) =>
      insertRow("/business_publication_routes", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        source_id: item.id,
        slug: item.slug,
        title: item.title,
        description: item.description,
        sort_order: item.sortOrder,
        active: item.active,
        created_at: now,
        updated_at: now,
      }),
    ),
    ...panel.blogs.map((item) =>
      insertRow("/business_publication_blog_posts", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        source_id: item.id,
        title: item.title,
        slug: item.slug,
        excerpt: item.excerpt,
        content: item.content,
        published: item.published,
        sort_order: item.sortOrder,
        created_at: now,
        updated_at: now,
      }),
    ),
    insertRow("/business_publication_seo", {
      id: randomUUID(),
      business_id: businessId,
      revision_id: revisionId,
      meta_title: panel.seo.metaTitle,
      meta_description: panel.seo.metaDescription,
      canonical_url: panel.seo.canonicalUrl,
      default_locale: panel.seo.defaultLocale,
      hreflang_enabled: panel.seo.hreflangEnabled,
      created_at: now,
      updated_at: now,
    }),
    ...panel.locales.map((item) =>
      insertRow("/business_publication_locales", {
        id: randomUUID(),
        business_id: businessId,
        revision_id: revisionId,
        source_id: item.id,
        code: item.code,
        name: item.name,
        active: item.active,
        published: item.published,
        translation_complete: item.translationComplete,
        created_at: now,
        updated_at: now,
      }),
    ),
  ]);

  const drafts = await readBusinessTranslationDrafts(businessId);
  await replacePublishedTranslationsForRevision(
    businessId,
    revisionId,
    drafts.filter((item) => item.localeCode && item.translatedText.trim()),
  );
}

async function createPublishedRevision(
  businessId: string,
  panel: BusinessPanelData,
  note: string,
) {
  if (!hasSupabaseConnection()) {
    const state = ensureDemoState(businessId);
    const currentPublished =
      state.revisions
        .slice()
        .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt))
        .find((item) => item.status === "published") ?? null;

    if (currentPublished) {
      currentPublished.status = "archived";
      currentPublished.archivedAt = nowIso();
    }

    const revision: BusinessPublicationRevisionRecord = {
      id: `publication-${randomUUID()}`,
      businessId,
      version:
        state.revisions.reduce((max, item) => Math.max(max, item.version), 0) + 1,
      status: "published",
      source: "manual",
      note,
      createdAt: nowIso(),
      publishedAt: nowIso(),
      archivedAt: null,
    };

    storeDemoSnapshot(businessId, revision, panel);
    const draftTranslations = await readBusinessTranslationDrafts(businessId);
    await replacePublishedTranslationsForRevision(businessId, revision.id, draftTranslations);
    return revision;
  }

  const history = await readLatestRevision(businessId);
  const currentPublished = history.find((item) => item.status === "published") ?? null;
  const nextVersion = history.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const now = nowIso();

  if (currentPublished) {
    const archiveResponse = await supabaseFetch(
      `/business_publication_revisions?id=eq.${encodeURIComponent(
        currentPublished.id,
      )}&business_id=eq.${encodeURIComponent(businessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "archived",
          archived_at: now,
        }),
      },
    );

    if (!archiveResponse?.ok) {
      throw new Error("Onceki yayin arsivlenemedi.");
    }
  }

  const revisionRow = await insertRow("/business_publication_revisions", {
    id: randomUUID(),
    business_id: businessId,
    version: nextVersion,
    status: "published",
    source: "manual",
    note,
    created_at: now,
    published_at: now,
    archived_at: null,
  });

  const revision = mapRevision(revisionRow ?? {});
  await insertPublishedSnapshot(businessId, revision.id, panel);
  return revision;
}

export async function ensureBusinessPublicationSeeded(businessId: string) {
  if (!normalizeString(businessId)) {
    return null;
  }

  if (!hasSupabaseConnection()) {
    const state = ensureDemoState(businessId);
    const published = state.revisions.some((item) => item.status === "published");
    if (!published) {
      const panel = await getBusinessPanelData(businessId);
      await createPublishedRevision(businessId, panel, "İlk yayın");
    }
    return getDemoPublishedPanel(businessId);
  }

  const publishedRevision = await readLatestPublishedRevision(businessId);

  if (publishedRevision) {
    return publishedRevision;
  }

  const panel = await getBusinessPanelData(businessId);
  await createPublishedRevision(businessId, panel, "İlk yayın");
  return readLatestPublishedRevision(businessId);
}

export async function publishBusinessContent(
  businessId: string,
  note = "Yayınlandı",
) {
  const safeBusinessId = businessId.trim();
  if (!safeBusinessId) {
    throw new Error("Business bulunamadi.");
  }

  const panel = await getBusinessPanelData(safeBusinessId);
  const revision = await createPublishedRevision(safeBusinessId, panel, note);
  return {
    revision,
    data: await getPublishingCenterData(safeBusinessId),
  };
}

export async function rollbackBusinessPublication(businessId: string) {
  const safeBusinessId = businessId.trim();
  if (!safeBusinessId) {
    throw new Error("Business bulunamadi.");
  }

  if (!hasSupabaseConnection()) {
    const state = ensureDemoState(safeBusinessId);
    const revisions = state.revisions
      .slice()
      .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt));
    const currentPublished = revisions.find((item) => item.status === "published") ?? null;
    const previousPublished = revisions.find((item) => item.status === "archived") ?? null;

    if (!currentPublished || !previousPublished) {
      throw new Error("Geri alinacak yayin bulunamadi.");
    }

    currentPublished.status = "archived";
    currentPublished.archivedAt = nowIso();
    previousPublished.status = "published";
    previousPublished.publishedAt = nowIso();
    state.revisions = revisions;
    demoPublicationStore.set(safeBusinessId, state);

    return {
      revision: previousPublished,
      data: await getPublishingCenterData(safeBusinessId),
    };
  }

  const revisions = await readLatestRevision(safeBusinessId);
  const currentPublished = revisions.find((item) => item.status === "published") ?? null;
  const previousPublished = revisions.find((item) => item.status === "archived") ?? null;

  if (!currentPublished || !previousPublished) {
    throw new Error("Geri alinacak yayin bulunamadi.");
  }

  const now = nowIso();

  await Promise.all([
    (async () => {
      const response = await supabaseFetch(
      `/business_publication_revisions?id=eq.${encodeURIComponent(
        currentPublished.id,
      )}&business_id=eq.${encodeURIComponent(safeBusinessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "archived",
          archived_at: now,
        }),
      },
      );

      if (!response?.ok) {
        throw new Error("Onceki yayin arsivlenemedi.");
      }
    })(),
    (async () => {
      const response = await supabaseFetch(
      `/business_publication_revisions?id=eq.${encodeURIComponent(
        previousPublished.id,
      )}&business_id=eq.${encodeURIComponent(safeBusinessId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "published",
          published_at: now,
          archived_at: null,
        }),
      },
      );

      if (!response?.ok) {
        throw new Error("Onceki yayin geri alinamadi.");
      }
    })(),
  ]);

  return {
    revision: previousPublished,
    data: await getPublishingCenterData(safeBusinessId),
  };
}

export async function getPublishingCenterData(
  businessId: string,
): Promise<BusinessPublishingCenterData> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return {
      business: null,
      draftPanel: null,
      currentRevision: null,
      publishedRevision: null,
      history: [],
    };
  }

  const [business, draftPanel, history] = await Promise.all([
    getBusinessById(safeBusinessId),
    getBusinessPanelData(safeBusinessId),
    hasSupabaseConnection()
      ? readLatestRevision(safeBusinessId)
      : Promise.resolve(
          (demoPublicationStore.get(safeBusinessId)?.revisions ?? []).slice().sort((left, right) => {
            if (left.version !== right.version) {
              return right.version - left.version;
            }
            return right.createdAt.localeCompare(left.createdAt);
          }),
        ),
  ]);

  if (!hasSupabaseConnection()) {
    const state = ensureDemoState(safeBusinessId);
    if (!state.revisions.some((item) => item.status === "published")) {
      await createPublishedRevision(safeBusinessId, draftPanel, "İlk yayın");
    }
    const refreshedState = demoPublicationStore.get(safeBusinessId);
    const refreshedHistory = refreshedState?.revisions
      .slice()
      .sort((left, right) => {
        if (left.version !== right.version) {
          return right.version - left.version;
        }
        return right.createdAt.localeCompare(left.createdAt);
      }) ?? [];

    const currentRevision =
      refreshedHistory.find((item) => item.status === "published") ?? null;

    return {
      business,
      draftPanel,
      currentRevision,
      publishedRevision: currentRevision,
      history: refreshedHistory,
    };
  }

  const publishedRevision = history.find((item) => item.status === "published") ?? null;

  if (!publishedRevision) {
    await createPublishedRevision(safeBusinessId, draftPanel, "İlk yayın");
    const refreshed = await readLatestRevision(safeBusinessId);
    const current = refreshed.find((item) => item.status === "published") ?? null;
    return {
      business,
      draftPanel,
      currentRevision: current,
      publishedRevision: current,
      history: refreshed,
    };
  }

  return {
    business,
    draftPanel,
    currentRevision: publishedRevision,
    publishedRevision,
    history,
  };
}

export async function getLatestPublishedRevisionForBusiness(businessId: string) {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return null;
  }

  if (!hasSupabaseConnection()) {
    const state = ensureDemoState(safeBusinessId);
    return (
      state.revisions
        .slice()
        .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt))
        .find((item) => item.status === "published") ?? null
    );
  }

  return readLatestPublishedRevision(safeBusinessId);
}

export async function getPublishedBusinessPanelDataByBusinessId(
  businessId: string,
): Promise<BusinessPanelData | null> {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return null;
  }

  await ensureBusinessPublicationSeeded(safeBusinessId);

  if (!hasSupabaseConnection()) {
    return getDemoPublishedPanel(safeBusinessId);
  }

  const revision = await readLatestPublishedRevision(safeBusinessId);

  if (!revision) {
    return null;
  }

  return readPublishedPanelFromRevision(safeBusinessId, revision.id);
}

export async function getPublishedBusinessTranslationsByBusinessId(
  businessId: string,
) {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    return [];
  }

  const revision = await getLatestPublishedRevisionForBusiness(safeBusinessId);

  if (!revision) {
    return [];
  }

  return readBusinessPublishedTranslationsByRevision(safeBusinessId, revision.id);
}
