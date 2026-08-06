// Block Registry'yi doldurmanın TEK yeri — her blok dosyası kendi modülü
// yüklendiğinde (top-level) registerBlock() çağırır. Yeni bir blok eklemek
// için: (1) lib/builder/blocks/<yeni-blok>.tsx dosyasını oluştur, (2) burada
// TEK bir side-effect import satırı ekle. Başka hiçbir dosyada değişiklik
// gerekmez — mevcut bloklar bu dosyadan veya birbirinden habersizdir.
import "@/lib/builder/blocks/hero";
import "@/lib/builder/blocks/services-grid";
import "@/lib/builder/blocks/cta";
// Faz 14 — profesyonel blok kütüphanesi.
import "@/lib/builder/blocks/hero-slider";
import "@/lib/builder/blocks/gallery";
import "@/lib/builder/blocks/faq";
import "@/lib/builder/blocks/testimonials";
import "@/lib/builder/blocks/statistics";
import "@/lib/builder/blocks/video";
import "@/lib/builder/blocks/trust-badges";
import "@/lib/builder/blocks/partners";
import "@/lib/builder/blocks/vehicle-showcase";
import "@/lib/builder/blocks/routes-showcase";
import "@/lib/builder/blocks/booking-cta";
import "@/lib/builder/blocks/contact-info";

export { heroBlock, type HeroContent, type HeroStyle } from "@/lib/builder/blocks/hero";
export { ctaBlock, type CtaContent, type CtaStyle } from "@/lib/builder/blocks/cta";
export {
  servicesGridBlock,
  type ServicesGridContent,
  type ServicesGridStyle,
  type ServicesGridData,
  type ServicesGridItem,
} from "@/lib/builder/blocks/services-grid";
export {
  heroSliderBlock,
  type HeroSliderContent,
  type HeroSliderStyle,
  type HeroSlide,
} from "@/lib/builder/blocks/hero-slider";
export {
  galleryBlock,
  type GalleryContent,
  type GalleryStyle,
  type GalleryData,
  type GalleryItem,
} from "@/lib/builder/blocks/gallery";
export { faqBlock, type FaqContent, type FaqStyle, type FaqItem } from "@/lib/builder/blocks/faq";
export {
  testimonialsBlock,
  type TestimonialsContent,
  type TestimonialsStyle,
  type TestimonialItem,
} from "@/lib/builder/blocks/testimonials";
export {
  statisticsBlock,
  type StatisticsContent,
  type StatisticsStyle,
  type StatItem,
} from "@/lib/builder/blocks/statistics";
export { videoBlock, type VideoContent, type VideoStyle } from "@/lib/builder/blocks/video";
export { trustBadgesBlock } from "@/lib/builder/blocks/trust-badges";
export { partnersBlock } from "@/lib/builder/blocks/partners";
export type { BadgeItem, BadgeListContent, BadgeListStyle } from "@/lib/builder/blocks/badge-list-shared";
export {
  vehicleShowcaseBlock,
  type VehicleShowcaseContent,
  type VehicleShowcaseStyle,
  type VehicleShowcaseData,
  type VehicleShowcaseItem,
} from "@/lib/builder/blocks/vehicle-showcase";
export {
  routesShowcaseBlock,
  type RouteShowcaseContent,
  type RouteShowcaseStyle,
  type RouteShowcaseData,
  type RouteShowcaseItem,
} from "@/lib/builder/blocks/routes-showcase";
export {
  bookingCtaBlock,
  type BookingCtaContent,
  type BookingCtaStyle,
  type BookingCtaData,
} from "@/lib/builder/blocks/booking-cta";
export {
  contactInfoBlock,
  type ContactInfoContent,
  type ContactInfoStyle,
  type ContactInfoData,
  type SocialLink,
} from "@/lib/builder/blocks/contact-info";
