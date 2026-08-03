// Block Registry'yi doldurmanın TEK yeri — her blok dosyası kendi modülü
// yüklendiğinde (top-level) registerBlock() çağırır. Yeni bir blok eklemek
// için: (1) lib/builder/blocks/<yeni-blok>.tsx dosyasını oluştur, (2) burada
// TEK bir side-effect import satırı ekle. Başka hiçbir dosyada değişiklik
// gerekmez — mevcut bloklar bu dosyadan veya birbirinden habersizdir.
import "@/lib/builder/blocks/hero";
import "@/lib/builder/blocks/services-grid";
import "@/lib/builder/blocks/cta";

export { heroBlock, type HeroContent, type HeroStyle } from "@/lib/builder/blocks/hero";
export { ctaBlock, type CtaContent, type CtaStyle } from "@/lib/builder/blocks/cta";
export {
  servicesGridBlock,
  type ServicesGridContent,
  type ServicesGridStyle,
  type ServicesGridData,
  type ServicesGridItem,
} from "@/lib/builder/blocks/services-grid";
