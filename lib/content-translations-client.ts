import { DEFAULT_PUBLIC_COPY } from "@/lib/public-copy";
import {
  TRANSLATION_SECTIONS,
  type SectionTranslationSeed,
  type TranslationSection,
} from "@/lib/translation-schema";

export type TranslationPanelShape = {
  business?: { name: string } | null;
  profile: { heroTitle: string; heroSubtitle: string; heroButtonText: string };
  services: Array<{ id: string; title: string; description: string }>;
  vehicles: Array<{ id: string; title: string; description: string }>;
  routes: Array<{ id: string; title: string; description: string }>;
  blogs: Array<{ id: string; title: string; excerpt: string; content: string }>;
  seo: { metaTitle: string; metaDescription: string };
};

export function getSectionLabel(section: TranslationSection) {
  return TRANSLATION_SECTIONS.find((item) => item.section === section)?.label ?? section;
}

export function getSectionDescription(section: TranslationSection) {
  return TRANSLATION_SECTIONS.find((item) => item.section === section)?.description ?? "";
}

export function buildTranslationSeeds(panel: TranslationPanelShape) {
  return {
    company: [
      { section: "company", sourceId: "business", fieldKey: "name", sourceText: panel.business?.name ?? "" },
    ],
    hero: [
      { section: "hero", sourceId: "profile", fieldKey: "heroTitle", sourceText: panel.profile.heroTitle ?? "" },
      { section: "hero", sourceId: "profile", fieldKey: "heroSubtitle", sourceText: panel.profile.heroSubtitle ?? "" },
      { section: "hero", sourceId: "profile", fieldKey: "heroButtonText", sourceText: panel.profile.heroButtonText ?? "" },
    ],
    service: panel.services.flatMap((item) => [
      { section: "service", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "service", sourceId: item.id, fieldKey: "description", sourceText: item.description ?? "" },
    ]),
    vehicle: panel.vehicles.flatMap((item) => [
      { section: "vehicle", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "vehicle", sourceId: item.id, fieldKey: "description", sourceText: item.description ?? "" },
    ]),
    route: panel.routes.flatMap((item) => [
      { section: "route", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "route", sourceId: item.id, fieldKey: "description", sourceText: item.description ?? "" },
    ]),
    blog: panel.blogs.flatMap((item) => [
      { section: "blog", sourceId: item.id, fieldKey: "title", sourceText: item.title ?? "" },
      { section: "blog", sourceId: item.id, fieldKey: "excerpt", sourceText: item.excerpt ?? "" },
      { section: "blog", sourceId: item.id, fieldKey: "content", sourceText: item.content ?? "" },
    ]),
    seo: [
      { section: "seo", sourceId: "seo", fieldKey: "metaTitle", sourceText: panel.seo.metaTitle ?? "" },
      { section: "seo", sourceId: "seo", fieldKey: "metaDescription", sourceText: panel.seo.metaDescription ?? "" },
    ],
    menus: [
      { section: "menus", sourceId: "main", fieldKey: "home", sourceText: DEFAULT_PUBLIC_COPY.menus.home },
      { section: "menus", sourceId: "main", fieldKey: "services", sourceText: DEFAULT_PUBLIC_COPY.menus.services },
      { section: "menus", sourceId: "main", fieldKey: "vehicles", sourceText: DEFAULT_PUBLIC_COPY.menus.vehicles },
      { section: "menus", sourceId: "main", fieldKey: "routes", sourceText: DEFAULT_PUBLIC_COPY.menus.routes },
      { section: "menus", sourceId: "main", fieldKey: "blogLabel", sourceText: DEFAULT_PUBLIC_COPY.menus.blog },
      { section: "menus", sourceId: "main", fieldKey: "contact", sourceText: DEFAULT_PUBLIC_COPY.menus.contact },
      { section: "menus", sourceId: "main", fieldKey: "quote", sourceText: DEFAULT_PUBLIC_COPY.menus.quote },
      { section: "menus", sourceId: "main", fieldKey: "booking", sourceText: DEFAULT_PUBLIC_COPY.menus.booking },
      { section: "menus", sourceId: "main", fieldKey: "languages", sourceText: DEFAULT_PUBLIC_COPY.menus.languages },
    ],
    publicForm: [
      { section: "publicForm", sourceId: "contact-form", fieldKey: "title", sourceText: DEFAULT_PUBLIC_COPY.publicForm.title },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "description", sourceText: DEFAULT_PUBLIC_COPY.publicForm.description },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "customerName", sourceText: DEFAULT_PUBLIC_COPY.publicForm.customerName },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "phone", sourceText: DEFAULT_PUBLIC_COPY.publicForm.phone },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "email", sourceText: DEFAULT_PUBLIC_COPY.publicForm.email },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "message", sourceText: DEFAULT_PUBLIC_COPY.publicForm.message },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "submit", sourceText: DEFAULT_PUBLIC_COPY.publicForm.submit },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "sending", sourceText: DEFAULT_PUBLIC_COPY.publicForm.sending },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "success", sourceText: DEFAULT_PUBLIC_COPY.publicForm.success },
      { section: "publicForm", sourceId: "contact-form", fieldKey: "error", sourceText: DEFAULT_PUBLIC_COPY.publicForm.error },
    ],
    voucher: [
      { section: "voucher", sourceId: "mail", fieldKey: "mailSubject", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailSubject },
      { section: "voucher", sourceId: "mail", fieldKey: "mailGreeting", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailGreeting },
      { section: "voucher", sourceId: "mail", fieldKey: "mailReservationNo", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailReservationNo },
      { section: "voucher", sourceId: "mail", fieldKey: "mailDateTime", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailDateTime },
      { section: "voucher", sourceId: "mail", fieldKey: "mailPhone", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailPhone },
      { section: "voucher", sourceId: "mail", fieldKey: "mailOrigin", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailOrigin },
      { section: "voucher", sourceId: "mail", fieldKey: "mailDestination", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailDestination },
      { section: "voucher", sourceId: "mail", fieldKey: "mailVoucherLink", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailVoucherLink },
      { section: "voucher", sourceId: "mail", fieldKey: "mailClosing", sourceText: DEFAULT_PUBLIC_COPY.voucher.mailClosing },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappGreeting", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappGreeting },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappReady", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappReady },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappReservationNo", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappReservationNo },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappDateTime", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappDateTime },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappOriginDestination", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappOriginDestination },
      { section: "voucher", sourceId: "whatsapp", fieldKey: "whatsappVoucher", sourceText: DEFAULT_PUBLIC_COPY.voucher.whatsappVoucher },
    ],
    booking: [
      { section: "booking", sourceId: "search", fieldKey: "eyebrow", sourceText: DEFAULT_PUBLIC_COPY.booking.eyebrow },
      { section: "booking", sourceId: "search", fieldKey: "title", sourceText: DEFAULT_PUBLIC_COPY.booking.title },
      { section: "booking", sourceId: "search", fieldKey: "description", sourceText: DEFAULT_PUBLIC_COPY.booking.description },
      { section: "booking", sourceId: "search", fieldKey: "searchPlaceholder", sourceText: DEFAULT_PUBLIC_COPY.booking.searchPlaceholder },
      { section: "booking", sourceId: "search", fieldKey: "searchButton", sourceText: DEFAULT_PUBLIC_COPY.booking.searchButton },
      { section: "booking", sourceId: "result", fieldKey: "openVoucher", sourceText: DEFAULT_PUBLIC_COPY.booking.openVoucher },
      { section: "booking", sourceId: "result", fieldKey: "statusLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.statusLabel },
      { section: "booking", sourceId: "result", fieldKey: "paymentLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.paymentLabel },
      { section: "booking", sourceId: "result", fieldKey: "dateLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.dateLabel },
      { section: "booking", sourceId: "result", fieldKey: "timeLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.timeLabel },
      { section: "booking", sourceId: "result", fieldKey: "originLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.originLabel },
      { section: "booking", sourceId: "result", fieldKey: "destinationLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.destinationLabel },
      { section: "booking", sourceId: "result", fieldKey: "vehicleLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.vehicleLabel },
      { section: "booking", sourceId: "result", fieldKey: "pickupLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.pickupLabel },
      { section: "booking", sourceId: "result", fieldKey: "passengersLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.passengersLabel },
      { section: "booking", sourceId: "result", fieldKey: "notesLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.notesLabel },
      { section: "booking", sourceId: "empty", fieldKey: "waitingTitle", sourceText: DEFAULT_PUBLIC_COPY.booking.waitingTitle },
      { section: "booking", sourceId: "empty", fieldKey: "waitingDescription", sourceText: DEFAULT_PUBLIC_COPY.booking.waitingDescription },
      { section: "booking", sourceId: "empty", fieldKey: "noResultTitle", sourceText: DEFAULT_PUBLIC_COPY.booking.noResultTitle },
      { section: "booking", sourceId: "empty", fieldKey: "noResultDescription", sourceText: DEFAULT_PUBLIC_COPY.booking.noResultDescription },
      { section: "booking", sourceId: "empty", fieldKey: "reservationLabel", sourceText: DEFAULT_PUBLIC_COPY.booking.reservationLabel },
    ],
  } satisfies Record<TranslationSection, SectionTranslationSeed[]>;
}
