import "server-only";

import { randomUUID } from "node:crypto";
import {
  getBusinessById,
  updateBusinessRecord,
  type BusinessRecord,
} from "@/lib/business";
import {
  type BusinessRequestRecord,
} from "@/lib/requests";
import { getSupabaseConfig } from "@/lib/supabase-config";

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
  | "logo"
  | "hero"
  | "service"
  | "vehicle"
  | "route"
  | "blog"
  | "seo"
  | "locale";

type PanelUpdate = {
  section: BusinessPanelSection;
  [key: string]: string | boolean | undefined;
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

function emptyPanelState(businessId: string): DemoPanelState {
  return {
    businessId,
    profile: {
      businessId,
      heroTitle: "",
      heroSubtitle: "",
      heroButtonText: "",
    },
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
      requests: [
        {
          id: "request-1",
          businessId: "business-demo-1",
          customerName: "Demo User",
          phone: "+90 555 111 22 33",
          email: "demo@example.com",
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

  if (!response?.ok) {
    return [];
  }

  return (await response.json()) as Array<Record<string, unknown>>;
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
  const config = getSupabaseConfig();

  if (!config) {
    const demo = getDemoPanel(businessId);
    return buildPanelResponse(demo, business);
  }

  const [
    profileRows,
    serviceRows,
    vehicleRows,
    routeRows,
    blogRows,
    seoRows,
    localeRows,
    requestRows,
  ] =
    await Promise.all([
      readRows(
        `/business_profiles?business_id=eq.${encodeURIComponent(
          businessId,
        )}&limit=1`,
      ),
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
      readRows(
        `/requests?business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=created_at.desc`,
      ),
    ]);

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
    requests: requestRows.map((row) => ({
      id: String(row.id ?? ""),
      businessId: String(row.business_id ?? ""),
      customerName: String(row.customer_name ?? ""),
      phone: (row.phone as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      message: String(row.message ?? ""),
      status: (row.status as BusinessRequestRecord["status"]) ?? "new",
      createdAt: String(row.created_at ?? ""),
    })),
  };
}

export async function updateBusinessPanelSection(
  businessId: string,
  payload: PanelUpdate,
) {
  const config = getSupabaseConfig();

  if (!config) {
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

    const response = await supabaseFetch(
      existing[0]
        ? `/business_seo?business_id=eq.${encodeURIComponent(businessId)}`
        : `/business_seo`,
      {
        method: existing[0] ? "PATCH" : "POST",
        body: JSON.stringify({
          business_id: businessId,
          meta_title: String(payload.metaTitle ?? "").trim(),
          meta_description: String(payload.metaDescription ?? "").trim(),
          canonical_url: business?.domain ? `https://${business.domain}` : "",
          default_locale: "tr",
          hreflang_enabled: true,
          updated_at: nowIso(),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("SEO guncellenemedi.");
    }

    return await getBusinessPanelData(businessId);
  }

  if (payload.section === "locale") {
    const code = String(payload.code ?? "").trim().toLowerCase();
    const existing = await readRows(
      `/business_locales?business_id=eq.${encodeURIComponent(
        businessId,
      )}&code=eq.${encodeURIComponent(code)}&limit=1`,
    );
    const response = await supabaseFetch(
      existing[0]
        ? `/business_locales?business_id=eq.${encodeURIComponent(
            businessId,
          )}&code=eq.${encodeURIComponent(code)}`
        : `/business_locales`,
      {
        method: existing[0] ? "PATCH" : "POST",
        body: JSON.stringify({
          business_id: businessId,
          code,
          name: String(payload.name ?? "").trim(),
          active: Boolean(payload.active ?? false),
          published: Boolean(payload.published ?? false),
          translation_complete: Boolean(payload.translationComplete ?? false),
        }),
      },
    );

    if (!response?.ok) {
      throw new Error("Dil kaydi olusturulamadi.");
    }

    return await getBusinessPanelData(businessId);
  }

  const tableBySection: Record<
    Exclude<BusinessPanelSection, "business" | "logo" | "hero" | "seo" | "locale">,
    string
  > = {
    service: "business_services",
    vehicle: "business_vehicles",
    route: "business_routes",
    blog: "business_blog_posts",
  };

  const collectionSection = payload.section as keyof typeof tableBySection;
  const table = tableBySection[collectionSection];
  const existingRows = await readRows(
    `/${table}?business_id=eq.${encodeURIComponent(
      businessId,
    )}&select=slug&order=created_at.asc`,
  );
  const existingSlugs = existingRows
    .map((row) => String(row.slug ?? ""))
    .filter(Boolean);
  const commonBody =
    payload.section === "blog"
      ? {
          business_id: businessId,
          title: String(payload.title ?? "").trim(),
          slug: uniqueSlug(
            String(payload.slug ?? payload.title ?? "").trim(),
            existingSlugs,
          ),
          excerpt: String(payload.excerpt ?? "").trim(),
          content: String(payload.content ?? "").trim(),
          published: Boolean(payload.published ?? false),
          sort_order: Number(payload.sortOrder ?? 0),
          created_at: nowIso(),
          updated_at: nowIso(),
        }
      : {
          business_id: businessId,
          slug: uniqueSlug(
            String(payload.title ?? "").trim(),
            existingSlugs,
          ),
          title: String(payload.title ?? "").trim(),
          description: String(payload.description ?? "").trim(),
          sort_order: Number(payload.sortOrder ?? 0),
          active: Boolean(payload.active ?? true),
          created_at: nowIso(),
          updated_at: nowIso(),
        };

  const response = await supabaseFetch(`/${table}`, {
    method: "POST",
    body: JSON.stringify(commonBody),
  });

  if (!response?.ok) {
    throw new Error("Kayit olusturulamadi.");
  }

  return await getBusinessPanelData(businessId);
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
  seo: Pick<BusinessSeoRecord, "metaTitle" | "metaDescription">,
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
      defaultLocale: current.seo.defaultLocale || "tr",
      hreflangEnabled: true,
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
