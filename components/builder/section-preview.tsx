import type { ReactNode } from "react";
import { BuilderFallback } from "@/components/builder/primitives";
import { getBlockDefinition } from "@/lib/builder/registry";
import { resolvePreviewData } from "@/lib/builder/preview-data-adapter";
import type { BuilderSection, BuilderTemplateSectionSeed } from "@/lib/builder/types";

// Section Preview — tek sorumluluğu: BİR section seed'ini çözüp render
// etmek. Template/Page katmanlarından habersizdir (yalnızca kendi seed'ini
// alır), bloklardan da habersizdir (yalnızca Block Registry'ye sorar).

export function SectionPreview({ section }: { section: BuilderTemplateSectionSeed }) {
  if (!section.active) {
    return null;
  }

  const definition = getBlockDefinition(section.blockKey);

  if (!definition) {
    return (
      <div data-builder-block={section.blockKey} data-builder-position={section.position} data-builder-error="unknown-block">
        <BuilderFallback reason={`Bilinmeyen blok: "${section.blockKey}". Bu section görüntülenemiyor.`} />
      </div>
    );
  }

  const variantExists = definition.variants.some((variant) => variant.key === section.variantKey);

  if (!variantExists) {
    return (
      <div
        data-builder-block={section.blockKey}
        data-builder-variant={section.variantKey}
        data-builder-position={section.position}
        data-builder-error="unknown-variant"
      >
        <definition.Fallback reason={`Bilinmeyen varyant: "${section.variantKey}" (blok: "${section.blockKey}").`} />
      </div>
    );
  }

  // Kaynak ne olursa olsun (template seed, ileride DB) içerik/stil/responsive
  // HER ZAMAN bloğun kendi validate()'inden yeniden geçer — "sunucu her şeyi
  // yeniden doğrular" ilkesinin preview katmanındaki devamı.
  const validated = definition.validate({
    variantKey: section.variantKey,
    content: section.content,
    style: section.style ?? {},
    responsive: section.responsive ?? {},
  });

  const runtimeSection: BuilderSection = {
    id: `preview-${section.blockKey}-${section.position}`,
    businessId: "preview",
    pageId: "preview",
    blockKey: section.blockKey,
    variantKey: section.variantKey,
    position: section.position,
    active: section.active,
    content: validated.content,
    style: validated.style,
    responsive: section.responsive ?? {},
    createdAt: "",
    updatedAt: "",
  };

  const previewData = resolvePreviewData(section.blockKey, validated.content);

  // React Error Boundary KULLANILMADI (bilinçli karar — bkz. Faz 5 raporu
  // "J" bölümü): Boundary, class component + "use client" gerektirir ve bu
  // katmanın Server Component disiplinini bozar. Bunun yerine renderer'ı
  // JSX olarak DEĞİL, düz bir fonksiyon olarak senkron çağırıyoruz — bu,
  // hataları normal bir try/catch ile yakalamamızı sağlıyor. Bu yalnızca
  // block renderer'ları hook KULLANMAYAN saf fonksiyonlar olduğu için
  // güvenlidir (bkz. hero.tsx/cta.tsx/services-grid.tsx — hiçbiri useState/
  // useEffect kullanmıyor); bir blok ileride hook kullanmaya başlarsa bu
  // desen YETERSİZ kalır ve gerçek bir Error Boundary'ye geçilmesi gerekir.
  let rendered: ReactNode;
  try {
    // Tip silme (type erasure) noktası: Block Registry, farklı TData ile
    // somutlaşmış tanımları tek bir erased BlockDefinition olarak döndürür
    // (bkz. lib/builder/registry.ts'teki aynı desenin gerekçesi). Bu yüzden
    // `previewData`nın gerçek şekli burada STATİK olarak bilinemez —
    // renderer'ın kendisi zaten `data`yı `unknown` bir kaynaktan geldiği
    // varsayımıyla ele almalıdır (services-grid.tsx `data?.items` ile
    // savunmacı okur).
    rendered = definition.PreviewRenderer({
      section: runtimeSection,
      breakpoint: "desktop",
      data: previewData as undefined,
    }) as ReactNode;
  } catch (error) {
    rendered = (
      <definition.Fallback
        reason={`Bu section render edilirken bir hata oluştu: ${error instanceof Error ? error.message : "bilinmeyen hata"}`}
      />
    );
  }

  return (
    <div
      data-builder-section-id={runtimeSection.id}
      data-builder-block={section.blockKey}
      data-builder-variant={section.variantKey}
      data-builder-position={section.position}
    >
      {rendered}
    </div>
  );
}
