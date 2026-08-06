import { BuilderContainer, BuilderFallback, BuilderHeading, BuilderText } from "@/components/builder/primitives";
import { VideoFacade } from "@/components/builder/blocks-client/video-facade";
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
import { readBoolean, readEmbedUrl, readImageSrc, readString } from "@/lib/builder/validation";

// ============================================================
// Video — Faz 14. YouTube/Vimeo embed, whitelist doğrulamalı (bkz.
// lib/builder/validation.ts readEmbedUrl — keyfi iframe src KABUL EDİLMEZ).
// Ağır embed JS'i varsayılan olarak hiç yüklenmez: gerçek <iframe>, yalnızca
// kullanıcı poster üzerindeki oynat düğmesine tıkladığında DOM'a eklenir
// (bkz. components/builder/blocks-client/video-facade.tsx).
// ============================================================

export interface VideoContent extends JsonRecord {
  title: string;
  description: string;
  embedUrl: string;
  posterImage: string;
}

export interface VideoStyle extends JsonRecord {
  aspectRatio: "16/9" | "9/16" | "4/3";
  autoplay: boolean;
}

const VIDEO_ASPECT_VALUES = ["16/9", "9/16", "4/3"] as const;

const VIDEO_VARIANTS = [
  { key: asVariantKey("standard"), label: "Standart", description: "Başlık, açıklama ve tek bir video." },
];

function defaultVideoContent(): VideoContent {
  return {
    title: "Hizmetimizi tanıyın",
    description: "Transfer sürecimizin nasıl işlediğini kısa videomuzda izleyin.",
    embedUrl: "",
    posterImage: "",
  };
}

function defaultVideoStyle(): VideoStyle {
  return { aspectRatio: "16/9", autoplay: false };
}

function validateVideo(input: BlockValidationInput): BuilderValidationResult<VideoContent, VideoStyle> {
  const issues: BuilderValidationIssue[] = [];
  const rawContent = (input.content && typeof input.content === "object" ? input.content : {}) as Record<string, unknown>;
  const rawStyle = (input.style && typeof input.style === "object" ? input.style : {}) as Record<string, unknown>;
  const fallbackContent = defaultVideoContent();
  const fallbackStyle = defaultVideoStyle();

  const content: VideoContent = {
    title: readString(rawContent.title, fallbackContent.title, "content.title", issues, { maxLength: 140 }),
    description: readString(rawContent.description, fallbackContent.description, "content.description", issues, { maxLength: 240 }),
    embedUrl: readEmbedUrl(rawContent.embedUrl, fallbackContent.embedUrl, "content.embedUrl", issues),
    posterImage: readImageSrc(rawContent.posterImage, fallbackContent.posterImage, "content.posterImage", issues),
  };

  const style: VideoStyle = {
    aspectRatio: readEnumAspect(rawStyle.aspectRatio, fallbackStyle.aspectRatio, issues),
    autoplay: readBoolean(rawStyle.autoplay, fallbackStyle.autoplay),
  };

  return { valid: issues.length === 0, issues, content, style };
}

function readEnumAspect(
  value: unknown,
  fallback: VideoStyle["aspectRatio"],
  issues: BuilderValidationIssue[],
): VideoStyle["aspectRatio"] {
  if (typeof value === "string" && (VIDEO_ASPECT_VALUES as readonly string[]).includes(value)) {
    return value as VideoStyle["aspectRatio"];
  }
  issues.push({ path: "style.aspectRatio", message: `Geçersiz değer, izin verilenler: ${VIDEO_ASPECT_VALUES.join(", ")}.` });
  return fallback;
}

function VideoView({ section }: BlockRendererProps<VideoContent, VideoStyle>) {
  const { content, style } = section;

  if (!content.embedUrl) {
    return <BuilderFallback reason="Henüz bir video bağlantısı eklenmedi." />;
  }

  return (
    <BuilderContainer>
      <div className="flex flex-col" style={{ gap: "var(--ps-space-md)" }}>
        {content.title ? (
          <BuilderHeading level="h2" size="3xl" className="ps-heading text-[var(--ps-text)]">
            {content.title}
          </BuilderHeading>
        ) : null}
        {content.description ? (
          <BuilderText size="base" className="max-w-2xl text-[var(--ps-text)] opacity-80">
            {content.description}
          </BuilderText>
        ) : null}
        <div className="overflow-hidden rounded-2xl" style={{ aspectRatio: style.aspectRatio }}>
          <VideoFacade autoplay={style.autoplay} embedUrl={content.embedUrl} posterImage={content.posterImage} title={content.title} />
        </div>
      </div>
    </BuilderContainer>
  );
}

export const videoBlock: BlockDefinition<VideoContent, VideoStyle> = {
  key: asBlockKey("video"),
  version: 1,
  label: "Video",
  description: "YouTube veya Vimeo videosu — poster + oynat düğmesiyle, ağır embed JS'i yalnızca tıklanınca yüklenir.",
  family: "media",
  variants: VIDEO_VARIANTS,
  defaultContent: defaultVideoContent,
  defaultStyle: defaultVideoStyle,
  validate: validateVideo,
  PreviewRenderer: VideoView,
  PublicRenderer: VideoView,
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
    icon: "play-circle",
    paletteGroup: "Medya",
    draggable: true,
  },
};

registerBlock(videoBlock);
