import { BuilderContainer, BuilderFallback, BuilderHeading, BuilderImage, BuilderText } from "@/components/builder/primitives";
import { registerBlock } from "@/lib/builder/registry";
import {
  asBlockKey,
  asVariantKey,
  type BlockDefinition,
  type BlockRendererProps,
  type BlockValidationInput,
  type BuilderValidationIssue,
  type BuilderValidationResult,
  type JsonRecord,
} from "@/lib/builder/types";
import { readBoolean, readNumber, readString } from "@/lib/builder/validation";

// ============================================================
// Gallery — Faz 14.
//
// ServicesGrid ile AYNI mimari: bu bloğun content'i yalnızca
// BAŞLIK/AYAR metinlerini taşır, GERÇEK görsel listesi (mevcut medya
// yükleme altyapısından — business_media_assets) `data` prop'u üzerinden
// dışarıdan sağlanır (bkz. lib/builder/public-data-adapter.ts). Yeni bir
// medya/yükleme sistemi KURULMAZ — yalnızca zaten var olan
// panel.mediaAssets gösterilir.
//
// "Lightbox hazırlığı": bu fazda tam bir JS lightbox kütüphanesi
// EKLENMEZ (performans hedefi). Bunun yerine her görsel kendi tam
// boyutlu kaynağına giden bir <a href> ile sarmalanır (yeni sekmede açılır)
// ve `data-ps-gallery-item` işaretleyicisi taşır — ileride eklenecek bir
// JS lightbox'ın hook edeceği hazır, JS'siz de çalışan bir taban.
// ============================================================

export interface GalleryItem {
  id: string;
  imageSrc: string;
  altText: string;
  caption: string;
}

export interface GalleryData {
  items: GalleryItem[];
}

export interface GalleryContent extends JsonRecord {
  eyebrow: string;
  title: string;
  description: string;
  maxItems: number;
  emptyStateTitle: string;
  emptyStateDescription: string;
}

export interface GalleryStyle extends JsonRecord {
  columns: number;
  mobileColumns: number;
  masonry: boolean;
}

const GALLERY_VARIANTS = [
  { key: asVariantKey("grid"), label: "Izgara", description: "Eşit veya masonry benzeri ızgara." },
  { key: asVariantKey("carousel"), label: "Kaydırmalı", description: "Yatayda kaydırılabilir görsel şeridi." },
];

function defaultGalleryContent(): GalleryContent {
  return {
    eyebrow: "Galeri",
    title: "Araçlarımızdan ve hizmetlerimizden kareler",
    description: "",
    maxItems: 12,
    emptyStateTitle: "Görsel yok",
    emptyStateDescription: "Bu işletme için henüz medya yüklenmedi.",
  };
}

function defaultGalleryStyle(): GalleryStyle {
  return { columns: 3, mobileColumns: 1, masonry: false };
}

function validateGallery(input: BlockValidationInput): BuilderValidationResult<GalleryContent, GalleryStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultGalleryContent();
  const fallbackStyle = defaultGalleryStyle();

  const content: GalleryContent = {
    eyebrow: readString(rawContent.eyebrow, fallbackContent.eyebrow, "content.eyebrow", issues, { maxLength: 60 }),
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    maxItems: readNumber(rawContent.maxItems, fallbackContent.maxItems, "content.maxItems", issues, { min: 1, max: 30 }),
    emptyStateTitle: readString(rawContent.emptyStateTitle, fallbackContent.emptyStateTitle, "content.emptyStateTitle", issues, { maxLength: 60 }),
    emptyStateDescription: readString(rawContent.emptyStateDescription, fallbackContent.emptyStateDescription, "content.emptyStateDescription", issues, { maxLength: 200 }),
  };

  const style: GalleryStyle = {
    columns: readNumber(rawStyle.columns, fallbackStyle.columns, "style.columns", issues, { min: 2, max: 4 }),
    mobileColumns: readNumber(rawStyle.mobileColumns, fallbackStyle.mobileColumns, "style.mobileColumns", issues, { min: 1, max: 2 }),
    masonry: readBoolean(rawStyle.masonry, fallbackStyle.masonry),
  };

  return { valid: issues.length === 0, issues, content, style };
}

const DESKTOP_COLUMN_CLASS: Record<number, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

const MOBILE_COLUMN_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
};

const MASONRY_COLUMN_CLASS: Record<number, string> = {
  2: "md:columns-2",
  3: "md:columns-3",
  4: "md:columns-4",
};

function GalleryTile({ item }: { item: GalleryItem }) {
  return (
    <a
      className="group block break-inside-avoid rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ps-primary)]"
      data-ps-gallery-item="true"
      href={item.imageSrc}
      rel="noopener noreferrer"
      target="_blank"
    >
      <BuilderImage alt={item.altText || item.caption} className="rounded-xl transition motion-reduce:transition-none group-hover:opacity-90" src={item.imageSrc} />
      {item.caption ? (
        <BuilderText size="sm" className="mt-1 opacity-70">
          {item.caption}
        </BuilderText>
      ) : null}
    </a>
  );
}

function GalleryView({ section, data }: BlockRendererProps<GalleryContent, GalleryStyle, GalleryData | undefined>) {
  const { content, style, variantKey } = section;
  const items = (data?.items ?? []).slice(0, content.maxItems);

  return (
    <BuilderContainer>
      <div className="flex flex-col" style={{ gap: "var(--ps-space-lg)" }}>
        {content.eyebrow ? (
          <BuilderText size="sm" className="uppercase tracking-[0.24em] text-[var(--ps-secondary)]">
            {content.eyebrow}
          </BuilderText>
        ) : null}
        <BuilderHeading level="h2" size="3xl" className="ps-heading text-[var(--ps-text)]">
          {content.title}
        </BuilderHeading>
        {content.description ? (
          <BuilderText size="base" className="ps-subtext max-w-2xl text-[var(--ps-text)] opacity-80">
            {content.description}
          </BuilderText>
        ) : null}

        {items.length === 0 ? (
          <BuilderFallback reason={content.emptyStateDescription || content.emptyStateTitle} />
        ) : String(variantKey) === "carousel" ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
            {items.map((item) => (
              <div className="w-[240px] shrink-0 snap-center" key={item.id}>
                <GalleryTile item={item} />
              </div>
            ))}
          </div>
        ) : style.masonry ? (
          <div className={`columns-1 gap-4 space-y-4 sm:columns-2 ${MASONRY_COLUMN_CLASS[style.columns] ?? MASONRY_COLUMN_CLASS[3]}`}>
            {items.map((item) => (
              <GalleryTile item={item} key={item.id} />
            ))}
          </div>
        ) : (
          <div className={`grid gap-4 ${MOBILE_COLUMN_CLASS[style.mobileColumns] ?? MOBILE_COLUMN_CLASS[1]} ${DESKTOP_COLUMN_CLASS[style.columns] ?? DESKTOP_COLUMN_CLASS[3]}`}>
            {items.map((item) => (
              <GalleryTile item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </BuilderContainer>
  );
}

export const galleryBlock: BlockDefinition<GalleryContent, GalleryStyle, GalleryData | undefined> = {
  key: asBlockKey("gallery"),
  version: 1,
  label: "Galeri",
  description: "Mevcut yüklenmiş görsellerden oluşan ızgara, masonry veya kaydırmalı galeri.",
  family: "media",
  variants: GALLERY_VARIANTS,
  defaultContent: defaultGalleryContent,
  defaultStyle: defaultGalleryStyle,
  validate: validateGallery,
  PreviewRenderer: GalleryView,
  PublicRenderer: GalleryView,
  Fallback: BuilderFallback,
  seoImpact: {
    headingLevel: "h2",
    isPrimaryContent: false,
  },
  responsiveCapabilities: {
    supportsVisibilityToggle: true,
    supportsReorder: true,
    supportsContentOverride: true,
    supportsStyleOverride: true,
  },
  themeCompatibility: "all",
  dragDrop: {
    icon: "image",
    paletteGroup: "Medya",
    draggable: true,
  },
};

registerBlock(galleryBlock);
