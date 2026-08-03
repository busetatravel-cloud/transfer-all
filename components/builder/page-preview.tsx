import { BuilderFallback } from "@/components/builder/primitives";
import { SectionPreview } from "@/components/builder/section-preview";
import type { BuilderTemplatePageSeed } from "@/lib/builder/types";

// Page Preview — tek sorumluluğu: bir sayfanın section LİSTESİNİ doğru
// sırada, güvenli sınırlar içinde render etmek. Tek bir section'ın hatası
// (bkz. SectionPreview'daki try/catch) burayı asla çökertmez; bu katman
// AYRICA sayfa-seviyesi bütünlük sorunlarını (duplicate position, boş
// sayfa, tüm section'lar pasif) kontrol eder.

export function PagePreview({ page }: { page: BuilderTemplatePageSeed }) {
  if (page.sections.length === 0) {
    return (
      <BuilderFallback reason={`"${page.title}" sayfası için henüz hiçbir section eklenmedi.`} />
    );
  }

  const positions = page.sections.map((section) => section.position);
  const hasDuplicatePositions = new Set(positions).size !== positions.length;

  if (hasDuplicatePositions) {
    return (
      <BuilderFallback
        reason={`"${page.title}" sayfasında birbirini tekrar eden section sırası (position) tespit edildi — önizleme güvenli şekilde durduruldu.`}
      />
    );
  }

  const orderedSections = [...page.sections].sort((a, b) => a.position - b.position);
  const activeSections = orderedSections.filter((section) => section.active);

  if (activeSections.length === 0) {
    return (
      <BuilderFallback reason={`"${page.title}" sayfasındaki tüm section'lar şu anda pasif durumda.`} />
    );
  }

  return (
    <div className="flex flex-col" style={{ gap: "var(--ps-space-3xl)" }}>
      {activeSections.map((section) => (
        <SectionPreview key={`${section.blockKey}-${section.position}`} section={section} />
      ))}
    </div>
  );
}
