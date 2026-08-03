import { getBlockDefinition, listBlockDefinitions } from "@/lib/builder/registry";
import { asBlockKey, asVariantKey, type BlockKey, type BuilderResponsiveOverrides, type JsonRecord } from "@/lib/builder/types";
import type { EditableSection } from "@/lib/builder/editable-section";

export type PageContainerWidth = "sm" | "md" | "lg" | "xl" | "full";
export type PageBackgroundMode = "light" | "soft" | "dark";

export interface WorkspacePageSettings {
  title: string;
  key: string;
  description: string;
  seoTitleHint: string;
  seoDescriptionHint: string;
  active: boolean;
  containerWidth: PageContainerWidth;
  backgroundMode: PageBackgroundMode;
  sectionGap: number;
  topSpacing: number;
  bottomSpacing: number;
}

export interface WorkspacePage extends WorkspacePageSettings {
  id: string;
  isSystemPage: boolean;
  sections: EditableSection[];
}

export interface WorkspaceNotice {
  tone: "info" | "error";
  text: string;
}

export interface WorkspaceSnapshot {
  pages: WorkspacePage[];
  selectedPageId: string;
  selectedSectionByPageId: Record<string, string | null>;
}

export interface WorkspaceHistory {
  past: WorkspaceSnapshot[];
  future: WorkspaceSnapshot[];
}

export interface WorkspaceState extends WorkspaceSnapshot {
  history: WorkspaceHistory;
  notice: WorkspaceNotice | null;
}

export type WorkspaceSectionPatch = {
  active?: boolean;
  content?: JsonRecord;
  style?: JsonRecord;
  responsive?: BuilderResponsiveOverrides;
};

export type WorkspacePagePatch = Partial<Omit<WorkspacePageSettings, "key">> & {
  key?: string;
};

export type WorkspaceAction =
  | { type: "select-page"; pageId: string }
  | { type: "select-section"; pageId: string; sectionId: string | null }
  | { type: "clear-selected-section"; pageId: string }
  | { type: "add-block"; pageId: string; blockKey: BlockKey }
  | { type: "clone-section"; pageId: string; sectionId: string }
  | { type: "delete-section"; pageId: string; sectionId: string }
  | { type: "toggle-section"; pageId: string; sectionId: string }
  | { type: "move-section"; pageId: string; sectionId: string; direction: "up" | "down" }
  | { type: "reorder-section"; pageId: string; fromId: string; toId: string }
  | { type: "update-section-content"; pageId: string; sectionId: string; patch: JsonRecord }
  | { type: "update-section-style"; pageId: string; sectionId: string; patch: JsonRecord }
  | { type: "update-section-variant"; pageId: string; sectionId: string; variantKey: string }
  | { type: "update-page"; pageId: string; patch: WorkspacePagePatch }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "dismiss-notice" };

type PageBlueprint = {
  id: string;
  key: string;
  title: string;
  description: string;
  seoTitleHint: string;
  seoDescriptionHint: string;
  isSystemPage: boolean;
  active: boolean;
  containerWidth: PageContainerWidth;
  backgroundMode: PageBackgroundMode;
  sectionGap: number;
  topSpacing: number;
  bottomSpacing: number;
  hero: {
    variant: string;
    content: JsonRecord;
    style: JsonRecord;
  };
  services: {
    variant: string;
    content: JsonRecord;
    style: JsonRecord;
  };
  cta: {
    variant: string;
    content: JsonRecord;
    style: JsonRecord;
  };
};

const HISTORY_LIMIT = 20;

const PAGE_BLUEPRINTS: PageBlueprint[] = [
  {
    id: "page-home",
    key: "home",
    title: "Home",
    description: "Ana giris ve ilk etki sayfasi.",
    seoTitleHint: "{business} | Transfer ve Turizm",
    seoDescriptionHint: "Güvenilir transfer, net CTA ve temiz kurumsal ilk izlenim.",
    isSystemPage: true,
    active: true,
    containerWidth: "xl",
    backgroundMode: "soft",
    sectionGap: 28,
    topSpacing: 32,
    bottomSpacing: 48,
    hero: {
      variant: "centered",
      content: {
        eyebrow: "Website Builder",
        title: "Canli preview ile public siteyi satir satir tasarla",
        subtitle: "Home, Services, Vehicles, Routes, Blog ve Contact sayfalarini tek bir preview state icinde duzenle.",
        primaryButtonText: "Preview ac",
        primaryButtonHref: "/app/website-builder",
        secondaryButtonText: "Sayfa agaci",
        secondaryButtonHref: "#pages",
      },
      style: { align: "left", overlay: "none" },
    },
    services: {
      variant: "grid",
      content: {
        eyebrow: "Block library",
        title: "Hero, Services Grid ve CTA ayni alanda canli calisir",
        description: "Secim, siralama ve stil degisiklikleri sadece bellek icinde tutulur.",
        emptyStateTitle: "Block yok",
        emptyStateDescription: "Preview state henuz olusturulmadi.",
        maxItems: 6,
      },
      style: { columns: 3 },
    },
    cta: {
      variant: "centered",
      content: {
        title: "Yayinlamadan once her sayfayi guvenle test et",
        description: "Degisiklikler sadece bu builder oturumunda kalir.",
        primaryButtonText: "Kontrol et",
        primaryButtonHref: "#inspector",
      },
      style: { tone: "brand" },
    },
  },
  {
    id: "page-services",
    key: "services",
    title: "Services",
    description: "Hizmet odakli sayfa akisi.",
    seoTitleHint: "{business} | Hizmetler",
    seoDescriptionHint: "Hizmet odakli landing sayfasi.",
    isSystemPage: true,
    active: true,
    containerWidth: "lg",
    backgroundMode: "light",
    sectionGap: 24,
    topSpacing: 24,
    bottomSpacing: 40,
    hero: {
      variant: "centered",
      content: {
        eyebrow: "Services",
        title: "Hizmet sayfasi icin net ve donusum odakli bir akis kur",
        subtitle: "Bu sayfa, hizmet kartlari ve CTA arasinda guclu bir denge ile kurgulandi.",
        primaryButtonText: "Hizmetleri incele",
        primaryButtonHref: "#services",
        secondaryButtonText: "Iletisim",
        secondaryButtonHref: "/contact",
      },
      style: { align: "left", overlay: "none" },
    },
    services: {
      variant: "grid",
      content: {
        eyebrow: "Service grid",
        title: "Paketleri kart halinde sun",
        description: "Baslik, aciklama ve kart sayisi preview state icinde hemen degisir.",
        emptyStateTitle: "Hizmet bulunamadi",
        emptyStateDescription: "Bu page icin henuz kart eklenmedi.",
        maxItems: 6,
      },
      style: { columns: 3 },
    },
    cta: {
      variant: "centered",
      content: {
        title: "Ozel hizmet paketi lazim mi?",
        description: "Daha fazla donusum icin CTA metnini ve button adresini hemen degistir.",
        primaryButtonText: "Teklif al",
        primaryButtonHref: "/quote",
      },
      style: { tone: "surface" },
    },
  },
  {
    id: "page-vehicles",
    key: "vehicles",
    title: "Vehicles",
    description: "Arac filosu odakli sayfa.",
    seoTitleHint: "{business} | Arac Filosu",
    seoDescriptionHint: "Araclari premium vitrinde sunan sayfa.",
    isSystemPage: true,
    active: true,
    containerWidth: "lg",
    backgroundMode: "light",
    sectionGap: 24,
    topSpacing: 24,
    bottomSpacing: 40,
    hero: {
      variant: "centered",
      content: {
        eyebrow: "Vehicles",
        title: "Arac filonuzu premium bir vitrine donustur",
        subtitle: "Bu sayfa, arac seceneklerini guven veren bir sunum diliyle konumlandirir.",
        primaryButtonText: "Filo gor",
        primaryButtonHref: "#vehicles",
        secondaryButtonText: "Rezervasyon",
        secondaryButtonHref: "/booking",
      },
      style: { align: "center", overlay: "none" },
    },
    services: {
      variant: "grid",
      content: {
        eyebrow: "Fleet highlights",
        title: "Konfor ve kapasiteyi one cikaran kartlar",
        description: "Columns ayari ve max item sayisi, arac sunumunda hizli bir test alani saglar.",
        emptyStateTitle: "Arac listesi yok",
        emptyStateDescription: "Preview icin kartlar henuz hazir degil.",
        maxItems: 4,
      },
      style: { columns: 4 },
    },
    cta: {
      variant: "centered",
      content: {
        title: "Filonuzun en guclu versiyonunu yayinlayin",
        description: "CTA ile arac sayfasi arasinda tek bir aksiyona odaklanan bir akis kur.",
        primaryButtonText: "Filo talep et",
        primaryButtonHref: "/contact",
      },
      style: { tone: "brand" },
    },
  },
  {
    id: "page-routes",
    key: "routes",
    title: "Routes",
    description: "Rota ve varis noktasi sunumu.",
    seoTitleHint: "{business} | Rotalar",
    seoDescriptionHint: "Transfer rotalarini ve varis noktalarini vurgulayan sayfa.",
    isSystemPage: true,
    active: true,
    containerWidth: "lg",
    backgroundMode: "light",
    sectionGap: 24,
    topSpacing: 24,
    bottomSpacing: 40,
    hero: {
      variant: "centered",
      content: {
        eyebrow: "Routes",
        title: "Rota sayfasinda hizli taranabilen bir bilgi yapisi kur",
        subtitle: "Varis noktasi, transfer mesafesi ve aksiyon butonlarini tek bir bakista kontrol et.",
        primaryButtonText: "Rotalari incele",
        primaryButtonHref: "#routes",
        secondaryButtonText: "Teklif al",
        secondaryButtonHref: "/quote",
      },
      style: { align: "left", overlay: "none" },
    },
    services: {
      variant: "grid",
      content: {
        eyebrow: "Route cards",
        title: "Kritik rotalari daha genis kartlarla vurgula",
        description: "Iki kolonlu sunum, uzun rota isimleri ve aciklamalar icin rahat bir alan saglar.",
        emptyStateTitle: "Rota listesi yok",
        emptyStateDescription: "Bu page icin rota verisi henuz eklenmedi.",
        maxItems: 6,
      },
      style: { columns: 2 },
    },
    cta: {
      variant: "centered",
      content: {
        title: "Hedef rotayi netlestir ve aksiyonu tek bir button'a bagla",
        description: "Sayfa yapisi sade kalsin, donusum odagi kaybolmasin.",
        primaryButtonText: "Rota teklif al",
        primaryButtonHref: "/quote",
      },
      style: { tone: "surface" },
    },
  },
  {
    id: "page-blog",
    key: "blog",
    title: "Blog",
    description: "Icerik ve SEO merkezli sayfa.",
    seoTitleHint: "{business} | Blog",
    seoDescriptionHint: "Bilgilendirici icerik ve SEO odakli sayfa.",
    isSystemPage: true,
    active: true,
    containerWidth: "lg",
    backgroundMode: "light",
    sectionGap: 24,
    topSpacing: 24,
    bottomSpacing: 40,
    hero: {
      variant: "centered",
      content: {
        eyebrow: "Blog",
        title: "Icerik merkezini SEO ve marka dili ile hizala",
        subtitle: "Blog sayfasinda hero, kartlar ve CTA arasindaki ritmi preview icinde test et.",
        primaryButtonText: "Yazilari gor",
        primaryButtonHref: "#blog",
        secondaryButtonText: "Iletisim",
        secondaryButtonHref: "/contact",
      },
      style: { align: "center", overlay: "none" },
    },
    services: {
      variant: "grid",
      content: {
        eyebrow: "Content cards",
        title: "Yazin, paylasin, optimize edin",
        description: "Bu alan blog iceriklerini temsil eden kartlarla birlikte gelir.",
        emptyStateTitle: "Yazi yok",
        emptyStateDescription: "Blog preview kartlari bekleniyor.",
        maxItems: 3,
      },
      style: { columns: 3 },
    },
    cta: {
      variant: "centered",
      content: {
        title: "Yeni bir icerik serisi baslat",
        description: "CTA ile blog okurunu teklif ya da iletisim aksiyonuna tasiyacaksin.",
        primaryButtonText: "Iletisim",
        primaryButtonHref: "/contact",
      },
      style: { tone: "brand" },
    },
  },
  {
    id: "page-contact",
    key: "contact",
    title: "Contact",
    description: "Teklif ve baglanti odakli sayfa.",
    seoTitleHint: "{business} | Iletisim",
    seoDescriptionHint: "Iletisim ve teklif odakli sayfa.",
    isSystemPage: true,
    active: true,
    containerWidth: "lg",
    backgroundMode: "light",
    sectionGap: 24,
    topSpacing: 24,
    bottomSpacing: 40,
    hero: {
      variant: "centered",
      content: {
        eyebrow: "Contact",
        title: "Iletisim ve teklif akisini tek bir karar noktasina indir",
        subtitle: "Form, button ve destek metinlerini canli preview ile hizla test et.",
        primaryButtonText: "Teklif formu",
        primaryButtonHref: "/quote",
        secondaryButtonText: "Ana sayfa",
        secondaryButtonHref: "/",
      },
      style: { align: "left", overlay: "none" },
    },
    services: {
      variant: "grid",
      content: {
        eyebrow: "Quick links",
        title: "Iletisimden once kullaniciya guven ver",
        description: "Iki kolonlu sunum, kontak bilgileri ve hizli aksiyonlar icin uygundur.",
        emptyStateTitle: "Baglanti yok",
        emptyStateDescription: "Bu page icin hizli erisim kartlari bekleniyor.",
        maxItems: 4,
      },
      style: { columns: 2 },
    },
    cta: {
      variant: "centered",
      content: {
        title: "Soruyu kisa tut, aksiyonu net tut",
        description: "Builder icinde buton metni ve hedefi degistirerek farkli senaryolari test et.",
        primaryButtonText: "Simdi yaz",
        primaryButtonHref: "/contact",
      },
      style: { tone: "surface" },
    },
  },
];

export function createInitialWorkspaceState(): WorkspaceState {
  const pages = PAGE_BLUEPRINTS.map(buildPageFromBlueprint);

  return createWorkspaceStateFromPages(pages);
}

export function createWorkspaceStateFromPages(
  pages: WorkspacePage[],
  selectedPageId = pages[0]?.id ?? "",
): WorkspaceState {
  return {
    pages: structuredClone(pages),
    selectedPageId,
    selectedSectionByPageId: Object.fromEntries(
      pages.map((page) => [page.id, page.sections[0]?.id ?? null]),
    ),
    history: {
      past: [],
      future: [],
    },
    notice: null,
  };
}

export function createWorkspaceStateFromSnapshot(snapshot: WorkspaceSnapshot): WorkspaceState {
  return {
    pages: structuredClone(snapshot.pages),
    selectedPageId: snapshot.selectedPageId,
    selectedSectionByPageId: structuredClone(snapshot.selectedSectionByPageId),
    history: {
      past: [],
      future: [],
    },
    notice: null,
  };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "select-page":
      return {
        ...state,
        selectedPageId: action.pageId,
        notice: null,
      };
    case "select-section":
      return {
        ...state,
        selectedPageId: action.pageId,
        selectedSectionByPageId: {
          ...state.selectedSectionByPageId,
          [action.pageId]: action.sectionId,
        },
        notice: null,
      };
    case "clear-selected-section":
      return {
        ...state,
        selectedSectionByPageId: {
          ...state.selectedSectionByPageId,
          [action.pageId]: null,
        },
        notice: null,
      };
    case "add-block":
      return addBlock(state, action.pageId, action.blockKey);
    case "clone-section":
      return cloneSection(state, action.pageId, action.sectionId);
    case "delete-section":
      return deleteSection(state, action.pageId, action.sectionId);
    case "toggle-section":
      return toggleSectionActive(state, action.pageId, action.sectionId);
    case "move-section":
      return moveSection(state, action.pageId, action.sectionId, action.direction);
    case "reorder-section":
      return reorderSection(state, action.pageId, action.fromId, action.toId);
    case "update-section-content":
      return updateSectionContent(state, action.pageId, action.sectionId, action.patch);
    case "update-section-style":
      return updateSectionStyle(state, action.pageId, action.sectionId, action.patch);
    case "update-section-variant":
      return updateSectionVariant(state, action.pageId, action.sectionId, action.variantKey);
    case "update-page":
      return updatePage(state, action.pageId, action.patch);
    case "undo":
      return undoWorkspace(state);
    case "redo":
      return redoWorkspace(state);
    case "dismiss-notice":
      return {
        ...state,
        notice: null,
      };
    default:
      return state;
  }
}

export function normalizePageKey(value: string): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isValidPageKey(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function getPageRoute(pageKey: string): string {
  return pageKey === "home" ? "/" : `/${pageKey}`;
}

export function listPaletteBlocks() {
  return listBlockDefinitions();
}

export function getPageById(state: Pick<WorkspaceState, "pages">, pageId: string) {
  return state.pages.find((page) => page.id === pageId);
}

export function getSectionById(page: Pick<WorkspacePage, "sections">, sectionId: string) {
  return page.sections.find((section) => section.id === sectionId);
}

export function getSelectedPage(state: WorkspaceState) {
  return getPageById(state, state.selectedPageId) ?? state.pages[0];
}

export function getSelectedSection(state: WorkspaceState) {
  const page = getSelectedPage(state);
  if (!page) {
    return null;
  }

  const selectedId = state.selectedSectionByPageId[page.id];
  return selectedId ? getSectionById(page, selectedId) ?? null : null;
}

export function getPageContainerWidthPx(width: PageContainerWidth): number | "100%" {
  switch (width) {
    case "sm":
      return 960;
    case "md":
      return 1080;
    case "lg":
      return 1200;
    case "xl":
      return 1360;
    case "full":
      return "100%";
  }
}

function buildPageFromBlueprint(blueprint: PageBlueprint): WorkspacePage {
  return {
    id: blueprint.id,
    key: blueprint.key,
    title: blueprint.title,
    description: blueprint.description,
    seoTitleHint: blueprint.seoTitleHint,
    seoDescriptionHint: blueprint.seoDescriptionHint,
    isSystemPage: blueprint.isSystemPage,
    active: blueprint.active,
    containerWidth: blueprint.containerWidth,
    backgroundMode: blueprint.backgroundMode,
    sectionGap: blueprint.sectionGap,
    topSpacing: blueprint.topSpacing,
    bottomSpacing: blueprint.bottomSpacing,
    sections: [
      createSection(blueprint.id, "hero", blueprint.hero.variant, 0, {
        content: blueprint.hero.content,
        style: blueprint.hero.style,
      }),
      createSection(blueprint.id, "services_grid", blueprint.services.variant, 1, {
        content: blueprint.services.content,
        style: blueprint.services.style,
      }),
      createSection(blueprint.id, "cta", blueprint.cta.variant, 2, {
        content: blueprint.cta.content,
        style: blueprint.cta.style,
      }),
    ],
  };
}

function createSection(
  pageId: string,
  blockKey: string,
  variantKey: string,
  position: number,
  patch: WorkspaceSectionPatch,
): EditableSection {
  const definition = getBlockDefinition(asBlockKey(blockKey));

  if (!definition) {
    throw new Error(`Missing block definition: ${blockKey}`);
  }

  const variant = asVariantKey(variantKey);
  const defaultContent = definition.defaultContent(variant);
  const defaultStyle = definition.defaultStyle(variant);
  const validated = definition.validate({
    variantKey: variant,
    content: { ...defaultContent, ...(patch.content ?? {}) },
    style: { ...defaultStyle, ...(patch.style ?? {}) },
    responsive: patch.responsive ?? {},
  });

  return {
    id: createSectionId(pageId, blockKey, position),
    blockKey: asBlockKey(blockKey),
    variantKey: variant,
    position,
    active: patch.active ?? true,
    content: validated.content,
    style: validated.style,
    responsive: patch.responsive ?? {},
  };
}

function createSectionId(pageId: string, blockKey: string, position: number) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${pageId}-${blockKey}-${position}-${crypto.randomUUID()}`;
  }

  return `${pageId}-${blockKey}-${position}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneSectionPayload(section: EditableSection): EditableSection {
  return {
    ...structuredClone(section),
    id: createSectionId("clone", String(section.blockKey), section.position),
  };
}

function normalizeSections(sections: EditableSection[]): EditableSection[] {
  return sections
    .slice()
    .map((section, index) => ({ ...section, position: index }));
}

function takeSnapshot(state: WorkspaceState): WorkspaceSnapshot {
  return snapshotWorkspaceState({
    pages: state.pages,
    selectedPageId: state.selectedPageId,
    selectedSectionByPageId: state.selectedSectionByPageId,
  });
}

export function snapshotWorkspaceState(
  state: Pick<WorkspaceSnapshot, "pages" | "selectedPageId" | "selectedSectionByPageId">,
): WorkspaceSnapshot {
  return structuredClone({
    pages: state.pages,
    selectedPageId: state.selectedPageId,
    selectedSectionByPageId: state.selectedSectionByPageId,
  }) as WorkspaceSnapshot;
}

function historyPastNext(history: WorkspaceHistory, snapshot: WorkspaceSnapshot): WorkspaceHistory {
  const past = [...history.past, snapshot].slice(-HISTORY_LIMIT);
  return {
    past,
    future: [],
  };
}

function commit(
  state: WorkspaceState,
  mutate: (draft: WorkspaceState) => boolean,
  options?: { notice?: WorkspaceNotice | null; trackHistory?: boolean },
): WorkspaceState {
  const draft = structuredClone(state) as WorkspaceState;
  const changed = mutate(draft);

  if (!changed) {
    return options?.notice === undefined ? state : { ...state, notice: options.notice };
  }

  draft.history = options?.trackHistory === false ? state.history : historyPastNext(state.history, takeSnapshot(state));
  draft.notice = options?.notice ?? null;
  return draft;
}

function ensureSelectionForPage(draft: WorkspaceState, pageId: string, preferredSectionId?: string | null) {
  const page = draft.pages.find((entry) => entry.id === pageId);
  if (!page) {
    return;
  }

  const ordered = normalizeSections(page.sections);
  page.sections = ordered;

  const resolvedPreferred = preferredSectionId ?? draft.selectedSectionByPageId[pageId] ?? null;
  const exists = resolvedPreferred ? ordered.some((section) => section.id === resolvedPreferred) : false;
  draft.selectedSectionByPageId[pageId] = exists ? resolvedPreferred : ordered[0]?.id ?? null;
}

function findPageMutation(draft: WorkspaceState, pageId: string) {
  const page = draft.pages.find((entry) => entry.id === pageId);
  return page ?? null;
}

function addBlock(state: WorkspaceState, pageId: string, blockKey: BlockKey): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    if (!page) {
      return false;
    }

    const definition = getBlockDefinition(blockKey);
    if (!definition) {
      return false;
    }

    const variant = definition.variants[0]?.key;
    if (!variant) {
      return false;
    }

    const section = createSection(page.id, String(blockKey), String(variant), page.sections.length, {
      content: definition.defaultContent(variant),
      style: definition.defaultStyle(variant),
      responsive: {},
      active: true,
    });

    page.sections = normalizeSections([...page.sections, section]);
    draft.selectedPageId = pageId;
    draft.selectedSectionByPageId[pageId] = section.id;
    return true;
  });
}

function cloneSection(state: WorkspaceState, pageId: string, sectionId: string): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    if (!page) {
      return false;
    }

    const index = page.sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      return false;
    }

    const original = page.sections[index];
    const clone = cloneSectionPayload(original);
    page.sections.splice(index + 1, 0, clone);
    page.sections = normalizeSections(page.sections);
    draft.selectedPageId = pageId;
    draft.selectedSectionByPageId[pageId] = clone.id;
    return true;
  });
}

function deleteSection(state: WorkspaceState, pageId: string, sectionId: string): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    if (!page) {
      return false;
    }

    const index = page.sections.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      return false;
    }

    page.sections.splice(index, 1);
    page.sections = normalizeSections(page.sections);

    const selected = draft.selectedSectionByPageId[pageId];
    if (selected === sectionId) {
      const next = page.sections[index] ?? page.sections[index - 1] ?? page.sections[0] ?? null;
      draft.selectedSectionByPageId[pageId] = next?.id ?? null;
    }

    if (page.sections.length === 0) {
      draft.selectedSectionByPageId[pageId] = null;
    }

    return true;
  });
}

function toggleSectionActive(state: WorkspaceState, pageId: string, sectionId: string): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    const section = page?.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return false;
    }

    section.active = !section.active;
    return true;
  });
}

function moveSection(
  state: WorkspaceState,
  pageId: string,
  sectionId: string,
  direction: "up" | "down",
): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    if (!page) {
      return false;
    }

    const ordered = normalizeSections(page.sections);
    const index = ordered.findIndex((section) => section.id === sectionId);
    if (index === -1) {
      return false;
    }

    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= ordered.length) {
      return false;
    }

    const [moved] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, moved);
    page.sections = normalizeSections(ordered);
    return true;
  });
}

function reorderSection(state: WorkspaceState, pageId: string, fromId: string, toId: string): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    if (!page || fromId === toId) {
      return false;
    }

    const ordered = normalizeSections(page.sections);
    const fromIndex = ordered.findIndex((section) => section.id === fromId);
    const toIndex = ordered.findIndex((section) => section.id === toId);

    if (fromIndex === -1 || toIndex === -1) {
      return false;
    }

    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    page.sections = normalizeSections(ordered);
    return true;
  });
}

function updateSectionContent(
  state: WorkspaceState,
  pageId: string,
  sectionId: string,
  patch: JsonRecord,
): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    const section = page?.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return false;
    }

    const definition = getBlockDefinition(section.blockKey);
    if (!definition) {
      return false;
    }

    const validated = definition.validate({
      variantKey: section.variantKey,
      content: { ...section.content, ...patch },
      style: section.style,
      responsive: section.responsive,
    });

    section.content = validated.content;
    section.style = validated.style;
    return true;
  });
}

function updateSectionStyle(
  state: WorkspaceState,
  pageId: string,
  sectionId: string,
  patch: JsonRecord,
): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    const section = page?.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return false;
    }

    const definition = getBlockDefinition(section.blockKey);
    if (!definition) {
      return false;
    }

    const validated = definition.validate({
      variantKey: section.variantKey,
      content: section.content,
      style: { ...section.style, ...patch },
      responsive: section.responsive,
    });

    section.content = validated.content;
    section.style = validated.style;
    return true;
  });
}

function updateSectionVariant(
  state: WorkspaceState,
  pageId: string,
  sectionId: string,
  variantKey: string,
): WorkspaceState {
  return commit(state, (draft) => {
    const page = findPageMutation(draft, pageId);
    const section = page?.sections.find((entry) => entry.id === sectionId);
    if (!section) {
      return false;
    }

    const definition = getBlockDefinition(section.blockKey);
    if (!definition) {
      return false;
    }

    const nextVariant = asVariantKey(variantKey);
    const hasVariant = definition.variants.some((variant) => variant.key === nextVariant);
    if (!hasVariant) {
      return false;
    }

    const validated = definition.validate({
      variantKey: nextVariant,
      content: section.content,
      style: section.style,
      responsive: section.responsive,
    });

    section.variantKey = nextVariant;
    section.content = validated.content;
    section.style = validated.style;
    return true;
  });
}

function updatePage(state: WorkspaceState, pageId: string, patch: WorkspacePagePatch): WorkspaceState {
  return commit(
    state,
    (draft) => {
      const page = findPageMutation(draft, pageId);
      if (!page) {
        return false;
      }

      if (page.isSystemPage && patch.key !== undefined && normalizePageKey(patch.key) !== page.key) {
        return false;
      }

      const nextTitle = typeof patch.title === "string" ? patch.title.trim() : page.title;
      const nextDescription = typeof patch.description === "string" ? patch.description.trim() : page.description;
      const nextSeoTitleHint = typeof patch.seoTitleHint === "string" ? patch.seoTitleHint.trim() : page.seoTitleHint;
      const nextSeoDescriptionHint =
        typeof patch.seoDescriptionHint === "string" ? patch.seoDescriptionHint.trim() : page.seoDescriptionHint;
      const nextKey = patch.key !== undefined ? normalizePageKey(patch.key) : page.key;

      if (patch.key !== undefined) {
        if (!nextKey) {
          return false;
        }

        const duplicate = draft.pages.some((entry) => entry.id !== pageId && entry.key === nextKey);
        if (duplicate) {
          return false;
        }
      }

      page.title = nextTitle || page.title;
      page.description = nextDescription || page.description;
      page.seoTitleHint = nextSeoTitleHint || page.seoTitleHint;
      page.seoDescriptionHint = nextSeoDescriptionHint || page.seoDescriptionHint;

      if (patch.key !== undefined && !page.isSystemPage) {
        page.key = nextKey;
      }

      if (typeof patch.active === "boolean") {
        page.active = patch.active;
      }

      if (patch.containerWidth) {
        page.containerWidth = patch.containerWidth;
      }

      if (patch.backgroundMode) {
        page.backgroundMode = patch.backgroundMode;
      }

      if (typeof patch.sectionGap === "number" && Number.isFinite(patch.sectionGap)) {
        page.sectionGap = patch.sectionGap;
      }

      if (typeof patch.topSpacing === "number" && Number.isFinite(patch.topSpacing)) {
        page.topSpacing = patch.topSpacing;
      }

      if (typeof patch.bottomSpacing === "number" && Number.isFinite(patch.bottomSpacing)) {
        page.bottomSpacing = patch.bottomSpacing;
      }

      if (patch.key !== undefined && !page.isSystemPage) {
        draft.selectedSectionByPageId[page.id] = draft.selectedSectionByPageId[page.id] ?? null;
      }

      return true;
    },
    { notice: null },
  );
}

function undoWorkspace(state: WorkspaceState): WorkspaceState {
  const previous = state.history.past.at(-1);
  if (!previous) {
    return state;
  }

  return {
    ...state,
    ...structuredClone(previous),
    history: {
      past: state.history.past.slice(0, -1),
      future: [takeSnapshot(state), ...state.history.future].slice(0, HISTORY_LIMIT),
    },
    notice: {
      tone: "info",
      text: "Son degisiklik geri alindi.",
    },
  };
}

function redoWorkspace(state: WorkspaceState): WorkspaceState {
  const next = state.history.future[0];
  if (!next) {
    return state;
  }

  return {
    ...state,
    ...structuredClone(next),
    history: {
      past: [...state.history.past, takeSnapshot(state)].slice(-HISTORY_LIMIT),
      future: state.history.future.slice(1),
    },
    notice: {
      tone: "info",
      text: "Geri alinan degisiklik tekrar uygulandi.",
    },
  };
}

export function findPageByKey(state: Pick<WorkspaceState, "pages">, key: string) {
  return state.pages.find((page) => page.key === key);
}

export function validatePageKeyCandidate(state: Pick<WorkspaceState, "pages">, pageId: string, candidateKey: string) {
  const normalized = normalizePageKey(candidateKey);

  if (!normalized) {
    return { valid: false, reason: "Page key bos olamaz." };
  }

  if (!isValidPageKey(normalized)) {
    return { valid: false, reason: "Page key gecerli bir slug olmali." };
  }

  const duplicate = state.pages.some((page) => page.id !== pageId && page.key === normalized);
  if (duplicate) {
    return { valid: false, reason: "Duplicate page key reddedildi." };
  }

  return { valid: true as const, normalized };
}
