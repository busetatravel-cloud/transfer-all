import "server-only";

import { randomUUID } from "node:crypto";
import {
  getBusinessById,
  updateBusinessAdminPasswordRecord,
  updateBusinessOwnDomainRecord,
  updateBusinessRecord,
  type BusinessRecord,
} from "@/lib/business";
import { translateTexts } from "@/lib/ai-translation";
import {
  deleteBusinessMediaAsset,
  listBusinessMediaAssets,
  upsertBusinessMediaAsset,
  type BusinessMediaAssetRecord,
} from "@/lib/media";
import {
  listBusinessCustomers,
  updateBusinessCustomerRecord,
  upsertBusinessCustomerFromReservation,
  type BusinessCustomerRecord,
} from "@/lib/customers";
import {
  getSectionSeeds,
  replaceBusinessTranslationDrafts,
  type TranslationFieldKey,
  type TranslationSection,
} from "@/lib/content-translations";
import { normalizeLanguageCode } from "@/lib/languages";
import {
  createReservation as createReservationRecord,
  updateReservation as updateReservationRecord,
} from "@/lib/reservation-service";
import {
  getBusinessRequests,
  type BusinessRequestRecord,
} from "@/lib/requests";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import { normalizeDomain } from "@/lib/platform";

export type BusinessProfileRecord = {
  businessId: string;
  heroTitle: string;
  heroSubtitle: string;
  heroButtonText: string;
};

export type BusinessServiceRecord = {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  active: boolean;
};

export type BusinessVehicleRecord = {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  active: boolean;
};

export type BusinessRouteRecord = {
  id: string;
  businessId: string;
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  active: boolean;
};

export type BusinessBlogRecord = {
  id: string;
  businessId: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: boolean;
  sortOrder: number;
};

export type BusinessSeoRecord = {
  businessId: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  defaultLocale: string;
  hreflangEnabled: boolean;
};

export type BusinessLocaleRecord = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  active: boolean;
  published: boolean;
  translationComplete: boolean;
};

export type BusinessPanelData = {
  business: BusinessRecord | null;
  profile: BusinessProfileRecord;
  mediaAssets: BusinessMediaAssetRecord[];
  customers: BusinessCustomerRecord[];
  services: BusinessServiceRecord[];
  vehicles: BusinessVehicleRecord[];
  routes: BusinessRouteRecord[];
  blogs: BusinessBlogRecord[];
  seo: BusinessSeoRecord;
  locales: BusinessLocaleRecord[];
  requests: BusinessRequestRecord[];
};

export type BusinessPanelSection =
  | "business"
  | "domain"
  | "password"
  | "logo"
  | "hero"
  | "media"
  | "reservation"
  | "customer"
  | "service"
  | "vehicle"
  | "route"
  | "blog"
  | "seo"
  | "locale";

type PanelUpdate = {
  section: BusinessPanelSection;
  action?: "create" | "update" | "delete";
  recordId?: string;
  [key: string]: string | boolean | number | undefined;
};

type DemoPanelState = Omit<BusinessPanelData, "business"> & {
  businessId: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function uniqueSlug(base: string, existing: string[]) {
  const fallback = slugify(base) || "item";
  let candidate = fallback;
  let index = 2;

  while (existing.includes(candidate)) {
    candidate = `${fallback}-${index}`;
    index += 1;
  }

  return candidate;
}

function nowIso() {
  return new Date().toISOString();
}

async function queueLocaleTranslationDrafts(
  businessId: string,
  panel: Pick<
    BusinessPanelData,
    "profile" | "services" | "vehicles" | "routes" | "blogs" | "seo"
  >,
  localeCode: string,
) {
  const normalizedLocale = normalizeLanguageCode(localeCode);

  if (!normalizedLocale) {
    return;
  }

  const seedsBySection = getSectionSeeds(panel);

  for (const [section, seeds] of Object.entries(seedsBySection) as Array<
    [keyof typeof seedsBySection, Array<{ section: TranslationSection; sourceId: string; fieldKey: TranslationFieldKey; sourceText: string }>]
  >) {
    if (!seeds.length) {
      continue;
    }

    const translatedTexts = await translateTexts({
      targetLocale: normalizedLocale,
      sourceLocale: panel.seo.defaultLocale || "tr",
      section: section as TranslationSection,
      fieldKeys: seeds.map((seed) => seed.fieldKey),
      texts: seeds.map((seed) => seed.sourceText),
      context: section,
    });

    await replaceBusinessTranslationDrafts(
      businessId,
      normalizedLocale,
      seeds.map((seed, index) => ({
        localeCode: normalizedLocale,
        section: seed.section,
        sourceId: seed.sourceId,
        fieldKey: seed.fieldKey,
        sourceText: seed.sourceText,
        translatedText: translatedTexts[index] ?? seed.sourceText,
      })),
      section as TranslationSection,
    );
  }
}

function emptyPanelState(businessId: string): DemoPanelState {
  return {
    businessId,
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

const demoPanels = new Map<string, DemoPanelState>([
  [
    "business-demo-1",
    {
      businessId: "business-demo-1",
      profile: {
        businessId: "business-demo-1",
        heroTitle: "Premium transfer cozumleri",
        heroSubtitle: "Havalimani, otel ve VIP transfer icin sade akis.",
        heroButtonText: "Teklif al",
      },
      mediaAssets: [],
      services: [
        {
          id: "service-1",
          businessId: "business-demo-1",
          slug: "airport-transfer",
          title: "Airport Transfer",
          description: "Havalimani ve otel transferleri.",
          sortOrder: 1,
          active: true,
        },
      ],
      vehicles: [
        {
          id: "vehicle-1",
          businessId: "business-demo-1",
          slug: "vip-van",
          title: "VIP Van",
          description: "4-7 yolcu icin",
          sortOrder: 1,
          active: true,
        },
      ],
      routes: [
        {
          id: "route-1",
          businessId: "business-demo-1",
          slug: "airport-city",
          title: "Airport - City",
          description: "Ana transfer rotasi",
          sortOrder: 1,
          active: true,
        },
      ],
      blogs: [
        {
          id: "blog-1",
          businessId: "business-demo-1",
          title: "Transfer ipuclari",
          slug: "transfer-ipuclari",
          excerpt: "Kisa rehber",
          content: "",
          published: true,
          sortOrder: 1,
        },
      ],
      seo: {
        businessId: "business-demo-1",
        metaTitle: "Buse Transfer",
        metaDescription: "Transfer hizmetleri",
        canonicalUrl: "https://demo-transfer.local",
        defaultLocale: "tr",
        hreflangEnabled: true,
      },
      locales: [
        {
          id: "locale-1",
          businessId: "business-demo-1",
          code: "tr",
          name: "Turkce",
          active: true,
          published: true,
          translationComplete: true,
        },
        {
          id: "locale-2",
          businessId: "business-demo-1",
          code: "en",
          name: "English",
          active: true,
          published: false,
          translationComplete: false,
        },
      ],
      customers: [
        {
          id: "customer-1",
          businessId: "business-demo-1",
          fullName: "Demo User",
          email: "demo@example.com",
          phone: "+90 555 111 22 33",
          country: "TR",
          language: "tr",
          source: "web",
          notes: "Airport transfer icin teklif istiyorum.",
          active: true,
          createdAt: "2026-06-10T10:00:00.000Z",
          updatedAt: "2026-06-10T10:00:00.000Z",
        },
      ],
      requests: [
        {
          id: "request-1",
          businessId: "business-demo-1",
          customerName: "Demo User",
          phone: "+90 555 111 22 33",
          email: "demo@example.com",
          country: "TR",
          language: "tr",
          origin: "Airport",
          destination: "Hotel",
          travelDate: "2026-06-10",
          travelTime: "10:30",
          flightCode: "TK123",
          adultCount: 2,
          childCount: 1,
          babyCount: 0,
          adults: 2,
          children: 1,
          infants: 0,
          vehicleCategory: "VIP",
          vehicleName: "VIP Van",
          supplierName: "Demo Supplier",
          agencyName: "Demo Agency",
          collectedAmount: 300,
          supplierPass: 120,
          agencyPass: 80,
          supplierCollection: 700,
          profit: 260,
          assignedVehicle: "VIP Van",
          driverName: "Demo Driver",
          pickupStatus: null,
          operationNotes: null,
          totalAmount: 1200,
          depositAmount: 300,
          remainingAmount: 900,
          currency: "TRY",
          paymentStatus: "Kapora Alındı",
          notes: "Airport transfer icin teklif istiyorum.",
          source: "web",
          bookingStatus: "Bekliyor",
          message: "Airport transfer icin teklif istiyorum.",
          status: "new",
          createdAt: "2026-06-10T10:00:00.000Z",
        },
      ],
    },
  ],
]);

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
  if (!text.trim()) {
    if (!response.ok) {
      throw new Error(
        JSON.stringify({
          code: "supabase_error",
          message: "Supabase sorgusu başarısız.",
          status: response.status,
          rawText: "",
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
        rawText: text,
      }),
    );
  }

  return Array.isArray(parsed) ? (parsed as Array<Record<string, unknown>>) : [];
}

function mapProfile(row: Record<string, unknown>, businessId: string): BusinessProfileRecord {
  return {
    businessId,
    heroTitle: String(row.hero_title ?? ""),
    heroSubtitle: String(row.hero_subtitle ?? ""),
    heroButtonText: String(row.hero_button_text ?? ""),
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

function getDemoPanel(businessId: string) {
  return demoPanels.get(businessId) ?? emptyPanelState(businessId);
}

function persistDemoPanel(businessId: string, patch: Partial<DemoPanelState>) {
  const current = getDemoPanel(businessId);
  const next = {
    ...current,
    ...patch,
  };

  demoPanels.set(businessId, next);
  return next;
}

function buildPanelResponse(
  panel: Omit<BusinessPanelData, "business">,
  business: BusinessRecord | null,
): BusinessPanelData {
  return {
    business,
    profile: panel.profile,
    mediaAssets: panel.mediaAssets,
    customers: panel.customers,
    services: panel.services,
    vehicles: panel.vehicles,
    routes: panel.routes,
    blogs: panel.blogs,
    seo: panel.seo,
    locales: panel.locales,
    requests: panel.requests,
  };
}

export async function getBusinessPanelData(
  businessId: string,
): Promise<BusinessPanelData> {
  const business = await getBusinessById(businessId);

  if (!hasSupabaseConnection()) {
    const demo = getDemoPanel(businessId);
    const mediaAssets = await listBusinessMediaAssets(businessId);
    const customerRows = await listBusinessCustomers(businessId);
    const customers = customerRows.length ? customerRows : demo.customers;
    return buildPanelResponse({ ...demo, mediaAssets, customers }, business);
  }

  const [
    profileRows,
    mediaRows,
    customerRows,
    serviceRows,
    vehicleRows,
    routeRows,
    blogRows,
    seoRows,
    localeRows,
  ] =
    await Promise.all([
      readRows(
        `/business_profiles?business_id=eq.${encodeURIComponent(
          businessId,
        )}&limit=1`,
      ),
      listBusinessMediaAssets(businessId),
      listBusinessCustomers(businessId),
      readRows(
        `/business_services?business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=sort_order.asc,created_at.asc`,
      ),
      readRows(
        `/business_vehicles?business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=sort_order.asc,created_at.asc`,
      ),
      readRows(
        `/business_routes?business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=sort_order.asc,created_at.asc`,
      ),
      readRows(
        `/business_blog_posts?business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=sort_order.asc,created_at.asc`,
      ),
      readRows(
        `/business_seo?business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
      ),
      readRows(
        `/business_locales?business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=created_at.asc`,
      ),
    ]);
  const requestRows = await getBusinessRequests(businessId);

  return {
    business,
    profile: profileRows[0]
      ? mapProfile(profileRows[0], businessId)
      : {
          businessId,
          heroTitle: "",
          heroSubtitle: "",
          heroButtonText: "",
        },
    mediaAssets: mediaRows,
    customers: customerRows,
    services: serviceRows.map(mapService),
    vehicles: vehicleRows.map(mapVehicle),
    routes: routeRows.map(mapRoute),
    blogs: blogRows.map(mapBlog),
    seo: seoRows[0]
      ? mapSeo(seoRows[0], businessId)
      : {
          businessId,
          metaTitle: "",
          metaDescription: "",
          canonicalUrl: "",
          defaultLocale: "tr",
          hreflangEnabled: true,
        },
    locales: localeRows.map(mapLocale),
    requests: requestRows,
  };
}

async function createReservation(
  businessId: string,
  input: Record<string, unknown>,
) {
  const request = await createReservationRecord(businessId, {
    customerName: String(input.customerName ?? ""),
    phone: String(input.phone ?? ""),
    email: String(input.email ?? ""),
    country: String(input.country ?? ""),
    language: String(input.language ?? ""),
    fromLocation: String(input.origin ?? ""),
    toLocation: String(input.destination ?? ""),
    date: String(input.travelDate ?? ""),
    time: String(input.travelTime ?? ""),
    flightCode: String(input.flightCode ?? ""),
    adultCount: Number(input.adults ?? 0),
    childCount: Number(input.children ?? 0),
    babyCount: Number(input.infants ?? 0),
    vehicleCategory: String(input.vehicleCategory ?? ""),
    vehicle: String(input.vehicleName ?? ""),
    total: String(input.totalAmount ?? ""),
    deposit: String(input.depositAmount ?? ""),
    remaining: String(input.remainingAmount ?? ""),
    currency: String(input.currency ?? ""),
    paymentStatus: String(input.paymentStatus ?? "Ödenmedi"),
    note: String(input.notes ?? ""),
    source: String(input.source ?? "manual"),
    bookingStatus: String(input.bookingStatus ?? "Bekliyor"),
    message: String(input.message ?? ""),
  });

  return {
    panel: await getBusinessPanelData(businessId),
    request,
  };
}

async function updateReservation(
  businessId: string,
  input: Record<string, unknown> & { recordId?: string },
) {
  const recordId = String(input.recordId ?? "").trim();

  if (!recordId) {
    throw new Error("Rezervasyon bulunamadi.");
  }

  await updateReservationRecord(businessId, {
    recordId,
    assignedVehicle:
      input.assignedVehicle === undefined ? undefined : String(input.assignedVehicle),
    driverName:
      input.driverName === undefined ? undefined : String(input.driverName),
    pickupStatus:
      input.pickupStatus === undefined ? undefined : String(input.pickupStatus),
    operationNotes:
      input.operationNotes === undefined ? undefined : String(input.operationNotes),
    bookingStatus:
      input.bookingStatus === undefined ? undefined : String(input.bookingStatus),
    vehicleName:
      input.vehicleName === undefined ? undefined : String(input.vehicleName),
    vehicleCategory:
      input.vehicleCategory === undefined ? undefined : String(input.vehicleCategory),
    paymentStatus:
      input.paymentStatus === undefined ? undefined : String(input.paymentStatus),
    notes: input.notes === undefined ? undefined : String(input.notes),
  });

  return await getBusinessPanelData(businessId);
}

export async function updateBusinessPanelSection(
  businessId: string,
  payload: PanelUpdate,
) {
  if (!hasSupabaseConnection()) {
    const demo = getDemoPanel(businessId);

    switch (payload.section) {
      case "business": {
        const currentBusiness = await getBusinessById(businessId);
        if (!currentBusiness) {
          throw new Error("Business bulunamadi.");
        }
        const business = await updateBusinessRecord(businessId, {
          name: String(payload.name ?? currentBusiness.name),
          email: String(payload.email ?? currentBusiness.email),
          phone: String(payload.phone ?? currentBusiness.phone ?? ""),
          whatsapp: String(payload.whatsapp ?? currentBusiness.whatsapp ?? ""),
          logoUrl: currentBusiness.logoUrl ?? "",
        });
        return buildPanelResponse(demo, business);
      }
      case "domain": {
        const business = await updateBusinessOwnDomainRecord(
          businessId,
          String(payload.domain ?? ""),
        );
        return buildPanelResponse(demo, business);
      }
      case "password": {
        const currentBusiness = await getBusinessById(businessId);
        if (!currentBusiness) {
          throw new Error("Business bulunamadi.");
        }
        await updateBusinessAdminPasswordRecord(
          businessId,
          String(payload.userId ?? ""),
          String(payload.newPassword ?? ""),
        );
        return buildPanelResponse(demo, currentBusiness);
      }
      case "logo": {
        return await updateBusinessLogoDemo(businessId, String(payload.logoUrl ?? ""));
      }
      case "hero": {
        return await updateBusinessHeroDemo(businessId, {
          heroTitle: String(payload.heroTitle ?? ""),
          heroSubtitle: String(payload.heroSubtitle ?? ""),
          heroButtonText: String(payload.heroButtonText ?? ""),
        });
      }
      case "media": {
        return await updateBusinessMediaRecord(businessId, payload);
      }
      case "reservation": {
        if (payload.action === "update") {
          const result = await updateReservation(businessId, {
            recordId: String(payload.recordId ?? ""),
            assignedVehicle:
              payload.assignedVehicle === undefined
                ? undefined
                : String(payload.assignedVehicle),
            driverName:
              payload.driverName === undefined
                ? undefined
                : String(payload.driverName),
            bookingStatus:
              payload.bookingStatus === undefined
                ? undefined
                : String(payload.bookingStatus),
            vehicleName:
              payload.vehicleName === undefined
                ? undefined
                : String(payload.vehicleName),
            vehicleCategory:
              payload.vehicleCategory === undefined
                ? undefined
                : String(payload.vehicleCategory),
            paymentStatus:
              payload.paymentStatus === undefined
                ? undefined
                : String(payload.paymentStatus),
            notes:
              payload.notes === undefined
                ? undefined
                : String(payload.notes),
          });

          return result;
        }

        const result = await createReservation(businessId, {
          customerName: String(payload.customerName ?? ""),
          phone: String(payload.phone ?? ""),
          email: String(payload.email ?? ""),
          country: String(payload.country ?? ""),
          language: String(payload.language ?? ""),
          origin: String(payload.origin ?? ""),
          destination: String(payload.destination ?? ""),
          travelDate: String(payload.travelDate ?? ""),
          travelTime: String(payload.travelTime ?? ""),
          flightCode: String(payload.flightCode ?? ""),
          adults: Number(payload.adults ?? 0),
          children: Number(payload.children ?? 0),
          infants: Number(payload.infants ?? 0),
          vehicleCategory: String(payload.vehicleCategory ?? ""),
          vehicleName: String(payload.vehicleName ?? ""),
          assignedVehicle: String(payload.assignedVehicle ?? ""),
          driverName: String(payload.driverName ?? ""),
          totalAmount: String(payload.totalAmount ?? ""),
          depositAmount: String(payload.depositAmount ?? ""),
          remainingAmount: String(payload.remainingAmount ?? ""),
          currency: String(payload.currency ?? ""),
          paymentStatus: String(payload.paymentStatus ?? "Ödenmedi"),
          notes: String(payload.notes ?? ""),
          source: String(payload.source ?? "manual"),
          bookingStatus: String(payload.bookingStatus ?? "Bekliyor"),
          message: String(payload.message ?? ""),
        });

        return result.panel;
      }
      case "customer": {
        const recordId = String(payload.recordId ?? "").trim();
        const action = payload.action ?? (recordId ? "update" : "create");

        if (action === "update") {
          if (!recordId) {
            throw new Error("Musteri bulunamadi.");
          }

          const source =
            String(payload.source ?? "").trim() || undefined;

          await updateBusinessCustomerRecord(businessId, recordId, {
            fullName: String(payload.fullName ?? "").trim() || undefined,
            email: String(payload.email ?? "").trim() || undefined,
            phone: String(payload.phone ?? "").trim() || undefined,
            country: String(payload.country ?? "").trim() || undefined,
            language: String(payload.language ?? "").trim() || undefined,
            notes: String(payload.notes ?? "").trim() || undefined,
            source,
          });

          return await getBusinessPanelData(businessId);
        }

        await upsertBusinessCustomerFromReservation(businessId, {
          fullName: String(payload.fullName ?? "").trim(),
          email: String(payload.email ?? "").trim() || undefined,
          phone: String(payload.phone ?? "").trim() || undefined,
          country: String(payload.country ?? "").trim() || undefined,
          language: String(payload.language ?? "").trim() || undefined,
          source: String(payload.source ?? "manual").trim() || "manual",
          notes: String(payload.notes ?? "").trim() || undefined,
        });
        return await getBusinessPanelData(businessId);
      }
      case "service":
        return await addBusinessItemDemo(businessId, "service", {
          title: String(payload.title ?? ""),
          description: String(payload.description ?? ""),
        });
      case "vehicle":
        return await addBusinessItemDemo(businessId, "vehicle", {
          title: String(payload.title ?? ""),
          description: String(payload.description ?? ""),
        });
      case "route":
        return await addBusinessItemDemo(businessId, "route", {
          title: String(payload.title ?? ""),
          description: String(payload.description ?? ""),
        });
      case "blog":
        return await addBusinessItemDemo(businessId, "blog", {
          title: String(payload.title ?? ""),
          slug: String(payload.slug ?? ""),
          excerpt: String(payload.excerpt ?? ""),
          content: String(payload.content ?? ""),
        });
      case "seo":
        return await updateBusinessSeoDemo(businessId, {
          metaTitle: String(payload.metaTitle ?? ""),
          metaDescription: String(payload.metaDescription ?? ""),
          defaultLocale: String(payload.defaultLocale ?? "tr"),
          hreflangEnabled:
            typeof payload.hreflangEnabled === "boolean" ? payload.hreflangEnabled : true,
        });
      case "locale":
        return await addBusinessLocaleDemo(businessId, {
          code: String(payload.code ?? ""),
          name: String(payload.name ?? ""),
          active: Boolean(payload.active ?? false),
          published: Boolean(payload.published ?? false),
          translationComplete: Boolean(payload.translationComplete ?? false),
        });
      default:
        throw new Error("Gecersiz alan.");
    }
  }

  switch (payload.section) {
    case "business": {
      const response = await supabaseFetch(
        `/businesses?id=eq.${encodeURIComponent(businessId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: String(payload.name ?? "").trim(),
            email: String(payload.email ?? "").trim(),
            phone: String(payload.phone ?? "").trim() || null,
            whatsapp: String(payload.whatsapp ?? "").trim() || null,
            updated_at: nowIso(),
          }),
        },
      );

      if (!response?.ok) {
        throw new Error("Firma bilgileri guncellenemedi.");
      }

      return await getBusinessPanelData(businessId);
    }
    case "domain": {
      const domain = normalizeDomain(String(payload.domain ?? ""));
      const existing = domain
        ? await readRows(
            `/businesses?select=id&domain=eq.${encodeURIComponent(domain)}&limit=1`,
          )
        : [];

      if (existing[0] && String(existing[0].id ?? "") !== businessId) {
        throw new Error("Bu domain zaten kullanılıyor.");
      }

      const response = await supabaseFetch(
        `/businesses?id=eq.${encodeURIComponent(businessId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            domain: domain || null,
            domain_status: "pending",
            updated_at: nowIso(),
          }),
        },
      );

      if (!response?.ok) {
        throw new Error("Domain kaydedilemedi.");
      }

      return await getBusinessPanelData(businessId);
    }
    case "password": {
      const userId = String(payload.userId ?? "");
      const newPassword = String(payload.newPassword ?? "");
      const confirmPassword = String(payload.confirmPassword ?? "");

      if (!userId) {
        throw new Error("Kullanici bulunamadi.");
      }

      if (!newPassword) {
        throw new Error("Yeni sifre gerekli.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Sifreler eslesmiyor.");
      }

      const result = await updateBusinessAdminPasswordRecord(
        businessId,
        userId,
        newPassword,
      );

      if (!result) {
        throw new Error("Sifre guncellenemedi.");
      }

      return await getBusinessPanelData(businessId);
    }
    case "logo": {
      const response = await supabaseFetch(
        `/businesses?id=eq.${encodeURIComponent(businessId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            logo_url: String(payload.logoUrl ?? "").trim() || null,
            updated_at: nowIso(),
          }),
        },
      );

      if (!response?.ok) {
        throw new Error("Logo guncellenemedi.");
      }

      return await getBusinessPanelData(businessId);
    }
    case "hero": {
      const existing = await readRows(
        `/business_profiles?business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
      );
      const response = await supabaseFetch(
        existing[0]
          ? `/business_profiles?business_id=eq.${encodeURIComponent(businessId)}`
          : `/business_profiles`,
        {
          method: existing[0] ? "PATCH" : "POST",
          body: JSON.stringify({
            business_id: businessId,
            hero_title: String(payload.heroTitle ?? "").trim(),
            hero_subtitle: String(payload.heroSubtitle ?? "").trim(),
            hero_button_text: String(payload.heroButtonText ?? "").trim(),
            updated_at: nowIso(),
          }),
        },
      );

      if (!response?.ok) {
        throw new Error("Hero guncellenemedi.");
      }

      return await getBusinessPanelData(businessId);
    }
    case "media": {
      return await updateBusinessMediaRecord(businessId, payload);
    }
    case "reservation": {
      if (payload.action === "update") {
        return await updateReservation(businessId, {
          recordId: String(payload.recordId ?? ""),
          assignedVehicle:
            payload.assignedVehicle === undefined
              ? undefined
              : String(payload.assignedVehicle),
          driverName:
            payload.driverName === undefined
              ? undefined
              : String(payload.driverName),
          bookingStatus:
            payload.bookingStatus === undefined
              ? undefined
              : String(payload.bookingStatus),
          vehicleName:
            payload.vehicleName === undefined
              ? undefined
              : String(payload.vehicleName),
          vehicleCategory:
            payload.vehicleCategory === undefined
              ? undefined
              : String(payload.vehicleCategory),
          paymentStatus:
            payload.paymentStatus === undefined
              ? undefined
              : String(payload.paymentStatus),
          notes:
            payload.notes === undefined
              ? undefined
              : String(payload.notes),
        });
      }

      const result = await createReservation(businessId, {
        customerName: String(payload.customerName ?? ""),
        phone: String(payload.phone ?? ""),
        email: String(payload.email ?? ""),
        country: String(payload.country ?? ""),
        language: String(payload.language ?? ""),
        origin: String(payload.origin ?? ""),
        destination: String(payload.destination ?? ""),
        travelDate: String(payload.travelDate ?? ""),
        travelTime: String(payload.travelTime ?? ""),
        flightCode: String(payload.flightCode ?? ""),
        adults: Number(payload.adults ?? 0),
        children: Number(payload.children ?? 0),
        infants: Number(payload.infants ?? 0),
        vehicleCategory: String(payload.vehicleCategory ?? ""),
        vehicleName: String(payload.vehicleName ?? ""),
        assignedVehicle: String(payload.assignedVehicle ?? ""),
        driverName: String(payload.driverName ?? ""),
        totalAmount: String(payload.totalAmount ?? ""),
        depositAmount: String(payload.depositAmount ?? ""),
        remainingAmount: String(payload.remainingAmount ?? ""),
        currency: String(payload.currency ?? ""),
        paymentStatus: String(payload.paymentStatus ?? "Ödenmedi"),
        notes: String(payload.notes ?? ""),
        source: String(payload.source ?? "manual"),
        bookingStatus: String(payload.bookingStatus ?? "Bekliyor"),
        message: String(payload.message ?? ""),
      });

      return result.panel;
    }
    case "customer": {
      const recordId = String(payload.recordId ?? "").trim();
      const action = payload.action ?? (recordId ? "update" : "create");

      if (action === "update") {
        if (!recordId) {
          throw new Error("Musteri bulunamadi.");
        }

        const source =
          String(payload.source ?? "").trim() || undefined;

        await updateBusinessCustomerRecord(businessId, recordId, {
          fullName: String(payload.fullName ?? "").trim() || undefined,
          email: String(payload.email ?? "").trim() || undefined,
          phone: String(payload.phone ?? "").trim() || undefined,
          country: String(payload.country ?? "").trim() || undefined,
          language: String(payload.language ?? "").trim() || undefined,
          notes: String(payload.notes ?? "").trim() || undefined,
          source,
        });

        return await getBusinessPanelData(businessId);
      }

      await upsertBusinessCustomerFromReservation(businessId, {
        fullName: String(payload.fullName ?? "").trim(),
        email: String(payload.email ?? "").trim() || undefined,
        phone: String(payload.phone ?? "").trim() || undefined,
        country: String(payload.country ?? "").trim() || undefined,
        language: String(payload.language ?? "").trim() || undefined,
        source: String(payload.source ?? "manual").trim() || "manual",
        notes: String(payload.notes ?? "").trim() || undefined,
      });
      return await getBusinessPanelData(businessId);
    }
    case "service":
    case "vehicle":
    case "route":
    case "blog":
    case "locale":
    case "seo":
      break;
  }

  if (payload.section === "seo") {
    const existing = await readRows(
      `/business_seo?business_id=eq.${encodeURIComponent(businessId)}&limit=1`,
    );
    const business = await getBusinessById(businessId);
    const currentSeoDefaultLocale = String(existing[0]?.default_locale ?? "tr");
    const currentSeoMetaTitle = String(existing[0]?.meta_title ?? "");
    const currentSeoMetaDescription = String(existing[0]?.meta_description ?? "");
    const currentSeoHreflangEnabled = Boolean(existing[0]?.hreflang_enabled ?? true);

    const response = await supabaseFetch(
      existing[0]
        ? `/business_seo?business_id=eq.${encodeURIComponent(businessId)}`
        : `/business_seo`,
        {
        method: existing[0] ? "PATCH" : "POST",
        body: JSON.stringify({
          business_id: businessId,
          meta_title: String(
            payload.metaTitle ?? currentSeoMetaTitle,
          ).trim(),
          meta_description: String(
            payload.metaDescription ?? currentSeoMetaDescription,
          ).trim(),
          canonical_url: business?.domain ? `https://${business.domain}` : "",
          default_locale:
            String(payload.defaultLocale ?? currentSeoDefaultLocale).trim() ||
              "tr",
          hreflang_enabled:
            typeof payload.hreflangEnabled === "boolean"
              ? payload.hreflangEnabled
                : currentSeoHreflangEnabled,
          updated_at: nowIso(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("SEO guncellenemedi.");
    }

    return await getBusinessPanelData(businessId);
  }

  return await updateBusinessCollectionSection(businessId, payload);
}

async function updateBusinessMediaRecord(
  businessId: string,
  payload: PanelUpdate,
) {
  const kind = String(payload.kind ?? "").trim();
  const action = payload.action ?? (payload.recordId ? "update" : "create");
  const sourceUrl = String(payload.previewDataUrl ?? payload.sourceUrl ?? "").trim();
  const altText = String(payload.altText ?? "").trim();
  const sortOrder = Number(payload.sortOrder ?? 0);
  const cropX = Number(payload.cropX ?? 50);
  const cropY = Number(payload.cropY ?? 50);
  const zoom = Number(payload.zoom ?? 1);
  const slot = String(payload.slot ?? kind).trim() || kind;
  const cover = Boolean(payload.cover ?? true);
  const fileName = String(payload.fileName ?? "").trim();

  if (!kind) {
    throw new Error("Medya tipi gerekli.");
  }

  if (action === "delete") {
    await deleteBusinessMediaAsset(businessId, kind);
    return await getBusinessPanelData(businessId);
  }

  await upsertBusinessMediaAsset(businessId, {
    kind,
    sourceUrl,
    altText,
    metadata: {
      fileName: fileName || undefined,
      previewDataUrl: sourceUrl || undefined,
      cropX,
      cropY,
      zoom,
      slot,
      altText: altText || undefined,
      cover,
    },
    sortOrder,
    status: sourceUrl ? "ready" : "placeholder",
  });

  return await getBusinessPanelData(businessId);
}

const collectionTableBySection = {
  service: "business_services",
  vehicle: "business_vehicles",
  route: "business_routes",
  blog: "business_blog_posts",
  locale: "business_locales",
} as const;

async function updateBusinessCollectionSection(
  businessId: string,
  payload: PanelUpdate,
) {
  if (!hasSupabaseConnection()) {
    return await updateBusinessCollectionDemo(businessId, payload);
  }

  switch (payload.section) {
    case "service":
    case "vehicle":
    case "route":
    case "blog":
      return await updateBusinessContentRecord(businessId, payload.section, payload);
    case "locale":
      return await updateBusinessLocaleRecord(businessId, payload);
    default:
      throw new Error("Gecersiz alan.");
  }
}

async function updateBusinessContentRecord(
  businessId: string,
  section: "service" | "vehicle" | "route" | "blog",
  payload: PanelUpdate,
) {
  const table = collectionTableBySection[section];
  const action = payload.action ?? (payload.recordId ? "update" : "create");
  const recordId = String(payload.recordId ?? "").trim();
  const rows = await readRows(
    `/${table}?business_id=eq.${encodeURIComponent(businessId)}&select=id,slug,title,description,excerpt,content,published,sort_order,active,created_at,updated_at&order=created_at.asc`,
  );
  const current = recordId
    ? rows.find((row) => String(row.id ?? "") === recordId) ?? null
    : null;

  if (action === "delete") {
    if (!recordId) {
      throw new Error("Kayit bulunamadi.");
    }

    const response = await supabaseFetch(
      `/${table}?id=eq.${encodeURIComponent(recordId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Kayit silinemedi.");
    }

    return await getBusinessPanelData(businessId);
  }

  if (action === "update" && !current) {
    throw new Error("Kayit bulunamadi.");
  }

  const existingSlugs = rows
    .filter((row) => String(row.id ?? "") !== recordId)
    .map((row) => String(row.slug ?? ""))
    .filter(Boolean);
  const title = String(payload.title ?? current?.title ?? "").trim();
  const description = String(payload.description ?? current?.description ?? "").trim();
  const excerpt = String(payload.excerpt ?? current?.excerpt ?? "").trim();
  const content = String(payload.content ?? current?.content ?? "").trim();
  const published =
    typeof payload.published === "boolean"
      ? payload.published
      : Boolean(current?.published ?? false);
  const active =
    typeof payload.active === "boolean"
      ? payload.active
      : Boolean(current?.active ?? true);
  const sortOrder = Number(payload.sortOrder ?? current?.sort_order ?? rows.length + 1);
  const slugSource =
    section === "blog"
      ? String(payload.slug ?? current?.slug ?? title).trim()
      : title;
  const slug = uniqueSlug(slugSource, existingSlugs);
  const body =
    section === "blog"
      ? {
          business_id: businessId,
          title,
          slug,
          excerpt,
          content,
          published,
          sort_order: sortOrder,
          updated_at: nowIso(),
        }
      : {
          business_id: businessId,
          slug,
          title,
          description,
          sort_order: sortOrder,
          active,
          updated_at: nowIso(),
        };

  const response = await supabaseFetch(
    action === "create"
      ? `/${table}`
      : `/${table}?id=eq.${encodeURIComponent(recordId)}&business_id=eq.${encodeURIComponent(
          businessId,
        )}`,
    {
      method: action === "create" ? "POST" : "PATCH",
      body: JSON.stringify(
        action === "create"
          ? {
              ...body,
              created_at: nowIso(),
            }
          : body,
      ),
    },
  );

  if (!response?.ok) {
    throw new Error(action === "create" ? "Kayit olusturulamadi." : "Kayit guncellenemedi.");
  }

  return await getBusinessPanelData(businessId);
}

async function updateBusinessLocaleRecord(
  businessId: string,
  payload: PanelUpdate,
) {
  const action = payload.action ?? (payload.recordId ? "update" : "create");
  const recordId = String(payload.recordId ?? "").trim();
  const panel = await getBusinessPanelData(businessId);
  const defaultLocale = String(panel.seo.defaultLocale ?? "").trim().toLowerCase();
  const rows = await readRows(
    `/business_locales?business_id=eq.${encodeURIComponent(businessId)}&select=id,code,name,active,published,translation_complete,created_at,updated_at&order=created_at.asc`,
  );
  const current = recordId
    ? rows.find((row) => String(row.id ?? "") === recordId) ?? null
    : null;

  if (action === "delete") {
    if (!recordId) {
      throw new Error("Dil kaydi bulunamadi.");
    }

    if (String(current?.code ?? "").trim().toLowerCase() === defaultLocale) {
      throw new Error("Varsayılan dil silinemez.");
    }

    const response = await supabaseFetch(
      `/business_locales?id=eq.${encodeURIComponent(recordId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Dil kaydi silinemedi.");
    }

    return await getBusinessPanelData(businessId);
  }

  if (action === "update" && !current) {
    throw new Error("Dil kaydi bulunamadi.");
  }

  const code = String(payload.code ?? current?.code ?? "").trim().toLowerCase();
  const name = String(payload.name ?? current?.name ?? "").trim();
  const active =
    typeof payload.active === "boolean"
      ? payload.active
      : Boolean(current?.active ?? false);
  const normalizedCode = code.toLowerCase();

  if (!active && defaultLocale && normalizedCode === defaultLocale) {
    throw new Error("Varsayılan dil kapatılamaz.");
  }

  const nextActive = normalizedCode === defaultLocale ? true : active;
  const published =
    typeof payload.published === "boolean"
      ? payload.published
      : Boolean(current?.published ?? false);
  const translationComplete =
    typeof payload.translationComplete === "boolean"
      ? payload.translationComplete
      : Boolean(current?.translation_complete ?? false);

  if (!code) {
    throw new Error("Dil kodu gerekli.");
  }

  const duplicate = rows.find(
    (row) =>
      String(row.id ?? "") !== recordId &&
      String(row.code ?? "").toLowerCase() === code,
  );

  if (duplicate) {
    throw new Error("Bu dil kodu zaten kullanılıyor.");
  }

  const body = {
    business_id: businessId,
    code,
    name,
    active: nextActive,
    published,
    translation_complete: translationComplete,
    updated_at: nowIso(),
  };

  const response = await supabaseFetch(
    action === "create"
      ? `/business_locales`
      : `/business_locales?id=eq.${encodeURIComponent(recordId)}&business_id=eq.${encodeURIComponent(
          businessId,
        )}`,
    {
      method: action === "create" ? "POST" : "PATCH",
      body: JSON.stringify(
        action === "create"
          ? {
              ...body,
              created_at: nowIso(),
            }
          : body,
      ),
    },
  );

  if (!response?.ok) {
    throw new Error(action === "create" ? "Dil kaydi olusturulamadi." : "Dil kaydi guncellenemedi.");
  }

  const updatedPanel = await getBusinessPanelData(businessId);
  if (nextActive) {
    await queueLocaleTranslationDrafts(businessId, updatedPanel, code);
  }

  return updatedPanel;
}

async function updateBusinessCollectionDemo(
  businessId: string,
  payload: PanelUpdate,
) {
  const current = getDemoPanel(businessId);
  const action = payload.action ?? (payload.recordId ? "update" : "create");
  const recordId = String(payload.recordId ?? "").trim();
  const defaultLocale = String(current.seo.defaultLocale ?? "").trim().toLowerCase();

  if (payload.section === "locale") {
    const code = String(payload.code ?? "").trim().toLowerCase();
    const name = String(payload.name ?? "").trim();
    const active =
      typeof payload.active === "boolean"
        ? payload.active
        : false;
    const published =
      typeof payload.published === "boolean"
        ? payload.published
        : false;
    const translationComplete =
      typeof payload.translationComplete === "boolean"
        ? payload.translationComplete
        : false;

    if (action === "delete") {
      if (!recordId) {
        throw new Error("Dil kaydi bulunamadi.");
      }

      if (String(current.locales.find((entry) => entry.id === recordId)?.code ?? "").trim().toLowerCase() === defaultLocale) {
        throw new Error("Varsayılan dil silinemez.");
      }

      const nextLocales = current.locales.filter((entry) => entry.id !== recordId);
      if (nextLocales.length === current.locales.length) {
        throw new Error("Dil kaydi bulunamadi.");
      }

      persistDemoPanel(businessId, { locales: nextLocales });
      return buildPanelResponse(getDemoPanel(businessId), await getBusinessById(businessId));
    }

    if (!code) {
      throw new Error("Dil kodu gerekli.");
    }

    if (!active && defaultLocale && code === defaultLocale) {
      throw new Error("Varsayılan dil kapatılamaz.");
    }

    const duplicate = current.locales.find(
      (entry) => entry.id !== recordId && entry.code.toLowerCase() === code,
    );

    if (duplicate) {
      throw new Error("Bu dil kodu zaten kullanılıyor.");
    }

    const nextLocale: BusinessLocaleRecord = {
      id: recordId || randomUUID(),
      businessId,
      code,
      name,
      active: code === defaultLocale ? true : active,
      published,
      translationComplete,
    };

    const locales = action === "create"
      ? [nextLocale, ...current.locales.filter((entry) => entry.code !== code)]
      : current.locales.map((entry) => (entry.id === recordId ? nextLocale : entry));

    persistDemoPanel(businessId, { locales });
    const updatedPanel = getDemoPanel(businessId);
    if (nextLocale.active) {
      await queueLocaleTranslationDrafts(businessId, updatedPanel, code);
    }
    return buildPanelResponse(updatedPanel, await getBusinessById(businessId));
  }

  const section = payload.section as "service" | "vehicle" | "route" | "blog";
  const itemsBySection = {
    service: current.services,
    vehicle: current.vehicles,
    route: current.routes,
    blog: current.blogs,
  } as const;
  const items = itemsBySection[section];

  if (action === "delete") {
    if (!recordId) {
      throw new Error("Kayit bulunamadi.");
    }

    const nextItems = items.filter((entry) => entry.id !== recordId);
    if (nextItems.length === items.length) {
      throw new Error("Kayit bulunamadi.");
    }

    persistDemoPanel(
      businessId,
      section === "service"
        ? { services: nextItems as BusinessServiceRecord[] }
        : section === "vehicle"
          ? { vehicles: nextItems as BusinessVehicleRecord[] }
          : section === "route"
            ? { routes: nextItems as BusinessRouteRecord[] }
            : { blogs: nextItems as BusinessBlogRecord[] },
    );
    return buildPanelResponse(getDemoPanel(businessId), await getBusinessById(businessId));
  }

  const currentItem = recordId
    ? items.find((entry) => entry.id === recordId) ?? null
    : null;

  if (action === "update" && !currentItem) {
    throw new Error("Kayit bulunamadi.");
  }

  const existingSlugs = items
    .filter((entry) => entry.id !== recordId)
    .map((entry) => entry.slug)
    .filter(Boolean);
  const title = String(payload.title ?? currentItem?.title ?? "").trim();
  const description =
    section === "blog"
      ? ""
      : String(
          payload.description ??
            (currentItem && "description" in currentItem
              ? currentItem.description
              : ""),
        ).trim();
  const slugSource =
    section === "blog"
      ? String(payload.slug ?? currentItem?.slug ?? title).trim()
      : title;
  const slug = uniqueSlug(slugSource, existingSlugs);
  const sortOrder = Number(payload.sortOrder ?? currentItem?.sortOrder ?? items.length + 1);
  const active =
    section === "blog"
      ? false
      : typeof payload.active === "boolean"
        ? payload.active
        : Boolean(
            currentItem && "active" in currentItem
              ? currentItem.active
              : true,
          );

  if (section === "blog") {
    const item: BusinessBlogRecord = {
      id: recordId || randomUUID(),
      businessId,
      title,
      slug,
      excerpt: String(
        payload.excerpt ??
          (currentItem && "excerpt" in currentItem ? currentItem.excerpt : ""),
      ).trim(),
      content: String(
        payload.content ??
          (currentItem && "content" in currentItem ? currentItem.content : ""),
      ).trim(),
      published:
        typeof payload.published === "boolean"
          ? payload.published
          : Boolean(
              currentItem && "published" in currentItem
                ? currentItem.published
                : false,
            ),
      sortOrder,
    };

    const blogs =
      action === "create"
        ? [item, ...current.blogs.filter((entry) => entry.slug !== item.slug)]
        : current.blogs.map((entry) => (entry.id === recordId ? item : entry));

    persistDemoPanel(businessId, { blogs });
    return buildPanelResponse(getDemoPanel(businessId), await getBusinessById(businessId));
  }

  if (section === "service") {
    const item: BusinessServiceRecord = {
      id: recordId || randomUUID(),
      businessId,
      slug,
      title,
      description,
      sortOrder,
      active,
    };

    const services =
      action === "create"
        ? [item, ...current.services.filter((entry) => entry.slug !== item.slug)]
        : current.services.map((entry) => (entry.id === recordId ? item : entry));

    persistDemoPanel(businessId, { services });
    return buildPanelResponse(getDemoPanel(businessId), await getBusinessById(businessId));
  }

  if (section === "vehicle") {
    const item: BusinessVehicleRecord = {
      id: recordId || randomUUID(),
      businessId,
      slug,
      title,
      description,
      sortOrder,
      active,
    };

    const vehicles =
      action === "create"
        ? [item, ...current.vehicles.filter((entry) => entry.slug !== item.slug)]
        : current.vehicles.map((entry) => (entry.id === recordId ? item : entry));

    persistDemoPanel(businessId, { vehicles });
    return buildPanelResponse(getDemoPanel(businessId), await getBusinessById(businessId));
  }

  const item: BusinessRouteRecord = {
    id: recordId || randomUUID(),
    businessId,
    slug,
    title,
    description,
    sortOrder,
    active,
  };

  const routes =
    action === "create"
      ? [item, ...current.routes.filter((entry) => entry.slug !== item.slug)]
      : current.routes.map((entry) => (entry.id === recordId ? item : entry));

  persistDemoPanel(businessId, { routes });
  return buildPanelResponse(getDemoPanel(businessId), await getBusinessById(businessId));
}

async function updateBusinessLogoDemo(businessId: string, logoUrl: string) {
  const currentBusiness = await getBusinessById(businessId);

  if (!currentBusiness) {
    throw new Error("Business bulunamadi.");
  }

  const business = await updateBusinessRecord(businessId, {
    name: currentBusiness.name,
    email: currentBusiness.email,
    phone: currentBusiness.phone ?? "",
    whatsapp: currentBusiness.whatsapp ?? "",
    logoUrl,
  });

  const current = getDemoPanel(businessId);
  return buildPanelResponse(current, business);
}

async function updateBusinessHeroDemo(
  businessId: string,
  hero: Pick<BusinessProfileRecord, "heroTitle" | "heroSubtitle" | "heroButtonText">,
) {
  persistDemoPanel(businessId, {
    profile: { businessId, ...hero },
  });
  const business = await getBusinessById(businessId);
  const next = getDemoPanel(businessId);
  return buildPanelResponse(next, business);
}

async function addBusinessItemDemo(
  businessId: string,
  section: "service" | "vehicle" | "route" | "blog",
  fields: Record<string, string>,
) {
  const current = getDemoPanel(businessId);
  const id = randomUUID();
  const itemsBySection = {
    service: current.services,
    vehicle: current.vehicles,
    route: current.routes,
    blog: current.blogs,
  } as const;
  const existingSlugs = itemsBySection[section].map((item) => {
    if ("slug" in item) {
      return item.slug;
    }

    return "";
  });
  const base = {
    id,
    businessId,
    title: fields.title,
    description: fields.description ?? "",
    sortOrder: itemsBySection[section].length + 1,
    active: true,
    slug: uniqueSlug(
      section === "blog" ? fields.slug || fields.title : fields.title,
      existingSlugs.filter(Boolean),
    ),
  };

  if (section === "blog") {
    const blog: BusinessBlogRecord = {
      ...base,
      excerpt: fields.excerpt ?? "",
      content: fields.content ?? "",
      published: false,
      sortOrder: current.blogs.length + 1,
    };
    persistDemoPanel(businessId, { blogs: [blog, ...current.blogs] });
  } else if (section === "service") {
    const item: BusinessServiceRecord = base;
    persistDemoPanel(businessId, { services: [item, ...current.services] });
  } else if (section === "vehicle") {
    const item: BusinessVehicleRecord = base;
    persistDemoPanel(businessId, { vehicles: [item, ...current.vehicles] });
  } else if (section === "route") {
    const item: BusinessRouteRecord = base;
    persistDemoPanel(businessId, { routes: [item, ...current.routes] });
  }

  const next = getDemoPanel(businessId);
  const business = await getBusinessById(businessId);
  return buildPanelResponse(next, business);
}

async function updateBusinessSeoDemo(
  businessId: string,
  seo: Pick<
    BusinessSeoRecord,
    "metaTitle" | "metaDescription" | "defaultLocale" | "hreflangEnabled"
  >,
) {
  const currentBusiness = await getBusinessById(businessId);
  const current = getDemoPanel(businessId);
  persistDemoPanel(businessId, {
    seo: {
      ...current.seo,
      businessId,
      ...seo,
      canonicalUrl: currentBusiness?.domain
        ? `https://${currentBusiness.domain}`
        : current.seo.canonicalUrl,
      defaultLocale: seo.defaultLocale || current.seo.defaultLocale || "tr",
      hreflangEnabled:
        typeof seo.hreflangEnabled === "boolean" ? seo.hreflangEnabled : true,
    },
  });
  const next = getDemoPanel(businessId);
  const business = await getBusinessById(businessId);
  return buildPanelResponse(next, business);
}

async function addBusinessLocaleDemo(
  businessId: string,
  locale: Pick<
    BusinessLocaleRecord,
    "code" | "name" | "active" | "published" | "translationComplete"
  >,
) {
  const current = getDemoPanel(businessId);
  const item: BusinessLocaleRecord = {
    id: randomUUID(),
    businessId,
    code: locale.code.toLowerCase(),
    name: locale.name,
    active: locale.active,
    published: locale.published,
    translationComplete: locale.translationComplete,
  };
  persistDemoPanel(businessId, {
    locales: [item, ...current.locales.filter((entry) => entry.code !== item.code)],
  });

  const next = getDemoPanel(businessId);
  const business = await getBusinessById(businessId);
  return buildPanelResponse(next, business);
}
