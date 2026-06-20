import "server-only";

import type { BusinessPanelData } from "@/lib/business-panel";
import type { BusinessLocaleRecord } from "@/lib/business-panel";
import {
  getLatestPublishedRevisionForBusiness,
  getPublishedBusinessTranslationsByBusinessId,
} from "@/lib/publishing";
import {
  buildTranslationDraftLookup,
  type PublishedTranslationRecord,
  type TranslationDraftRecord,
} from "@/lib/content-translations";
import { buildTranslationFallback } from "@/lib/ai-translation";
import { DEFAULT_PUBLIC_COPY, type PublicCopy } from "@/lib/public-copy";
import {
  isRTLLanguage,
  normalizeLanguageCode,
  type SupportedLanguageCode,
} from "@/lib/languages";

export type PublicSiteLocalization = {
  locale: SupportedLanguageCode;
  fallbackLocale: SupportedLanguageCode;
  isRtl: boolean;
  availableLocales: BusinessLocaleRecord[];
  panel: BusinessPanelData;
  copy: PublicCopy;
};

function clonePanel(panel: BusinessPanelData): BusinessPanelData {
  return typeof structuredClone === "function"
    ? structuredClone(panel)
    : (JSON.parse(JSON.stringify(panel)) as BusinessPanelData);
}

function getSupportedLocaleCodes(locales: BusinessLocaleRecord[]) {
  return locales
    .filter((locale) => locale.active)
    .map((locale) => normalizeLanguageCode(locale.code))
    .filter((code): code is SupportedLanguageCode => Boolean(code));
}

function getFallbackLocale(panel: BusinessPanelData, available: SupportedLanguageCode[]) {
  const seoFallback = normalizeLanguageCode(panel.seo.defaultLocale);

  if (seoFallback && available.includes(seoFallback)) {
    return seoFallback;
  }

  if (available.includes("tr")) {
    return "tr";
  }

  return available[0] ?? "tr";
}

function resolveTranslation(
  lookup: Map<string, TranslationDraftRecord | PublishedTranslationRecord>,
  locale: SupportedLanguageCode,
  section: string,
  sourceId: string,
  fieldKey: string,
) {
  return lookup.get(`${locale}:${section}:${sourceId}:${fieldKey}`)?.translatedText ?? "";
}

function applyText(
  lookup: Map<string, TranslationDraftRecord | PublishedTranslationRecord>,
  locale: SupportedLanguageCode,
  fallbackLocale: SupportedLanguageCode,
  section: string,
  sourceId: string,
  fieldKey: string,
  sourceText: string,
) {
  return (
    resolveTranslation(lookup, locale, section, sourceId, fieldKey) ||
    resolveTranslation(lookup, fallbackLocale, section, sourceId, fieldKey) ||
    sourceText ||
    buildTranslationFallback(locale, sourceText)
  );
}

function localizeCopyField(
  lookup: Map<string, TranslationDraftRecord | PublishedTranslationRecord>,
  locale: SupportedLanguageCode,
  fallbackLocale: SupportedLanguageCode,
  copy: PublicCopy,
) {
  return {
    menus: {
      home: applyText(lookup, locale, fallbackLocale, "menus", "main", "home", copy.menus.home),
      services: applyText(lookup, locale, fallbackLocale, "menus", "main", "services", copy.menus.services),
      vehicles: applyText(lookup, locale, fallbackLocale, "menus", "main", "vehicles", copy.menus.vehicles),
      routes: applyText(lookup, locale, fallbackLocale, "menus", "main", "routes", copy.menus.routes),
      blog: applyText(lookup, locale, fallbackLocale, "menus", "main", "blogLabel", copy.menus.blog),
      contact: applyText(lookup, locale, fallbackLocale, "menus", "main", "contact", copy.menus.contact),
      quote: applyText(lookup, locale, fallbackLocale, "menus", "main", "quote", copy.menus.quote),
      booking: applyText(lookup, locale, fallbackLocale, "menus", "main", "booking", copy.menus.booking),
      languages: applyText(lookup, locale, fallbackLocale, "menus", "main", "languages", copy.menus.languages),
    },
    publicForm: {
      title: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "title", copy.publicForm.title),
      description: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "description", copy.publicForm.description),
      customerName: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "customerName", copy.publicForm.customerName),
      phone: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "phone", copy.publicForm.phone),
      email: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "email", copy.publicForm.email),
      message: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "message", copy.publicForm.message),
      submit: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "submit", copy.publicForm.submit),
      sending: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "sending", copy.publicForm.sending),
      success: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "success", copy.publicForm.success),
      error: applyText(lookup, locale, fallbackLocale, "publicForm", "contact-form", "error", copy.publicForm.error),
    },
    voucher: {
      mailSubject: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailSubject", copy.voucher.mailSubject),
      mailGreeting: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailGreeting", copy.voucher.mailGreeting),
      mailReservationNo: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailReservationNo", copy.voucher.mailReservationNo),
      mailDateTime: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailDateTime", copy.voucher.mailDateTime),
      mailPhone: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailPhone", copy.voucher.mailPhone),
      mailOrigin: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailOrigin", copy.voucher.mailOrigin),
      mailDestination: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailDestination", copy.voucher.mailDestination),
      mailVoucherLink: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailVoucherLink", copy.voucher.mailVoucherLink),
      mailClosing: applyText(lookup, locale, fallbackLocale, "voucher", "mail", "mailClosing", copy.voucher.mailClosing),
      whatsappGreeting: applyText(lookup, locale, fallbackLocale, "voucher", "whatsapp", "whatsappGreeting", copy.voucher.whatsappGreeting),
      whatsappReady: applyText(lookup, locale, fallbackLocale, "voucher", "whatsapp", "whatsappReady", copy.voucher.whatsappReady),
      whatsappReservationNo: applyText(lookup, locale, fallbackLocale, "voucher", "whatsapp", "whatsappReservationNo", copy.voucher.whatsappReservationNo),
      whatsappDateTime: applyText(lookup, locale, fallbackLocale, "voucher", "whatsapp", "whatsappDateTime", copy.voucher.whatsappDateTime),
      whatsappOriginDestination: applyText(lookup, locale, fallbackLocale, "voucher", "whatsapp", "whatsappOriginDestination", copy.voucher.whatsappOriginDestination),
      whatsappVoucher: applyText(lookup, locale, fallbackLocale, "voucher", "whatsapp", "whatsappVoucher", copy.voucher.whatsappVoucher),
    },
    booking: {
      eyebrow: applyText(lookup, locale, fallbackLocale, "booking", "search", "eyebrow", copy.booking.eyebrow),
      title: applyText(lookup, locale, fallbackLocale, "booking", "search", "title", copy.booking.title),
      description: applyText(lookup, locale, fallbackLocale, "booking", "search", "description", copy.booking.description),
      searchPlaceholder: applyText(lookup, locale, fallbackLocale, "booking", "search", "searchPlaceholder", copy.booking.searchPlaceholder),
      searchButton: applyText(lookup, locale, fallbackLocale, "booking", "search", "searchButton", copy.booking.searchButton),
      openVoucher: applyText(lookup, locale, fallbackLocale, "booking", "result", "openVoucher", copy.booking.openVoucher),
      statusLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "statusLabel", copy.booking.statusLabel),
      paymentLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "paymentLabel", copy.booking.paymentLabel),
      dateLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "dateLabel", copy.booking.dateLabel),
      timeLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "timeLabel", copy.booking.timeLabel),
      originLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "originLabel", copy.booking.originLabel),
      destinationLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "destinationLabel", copy.booking.destinationLabel),
      vehicleLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "vehicleLabel", copy.booking.vehicleLabel),
      pickupLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "pickupLabel", copy.booking.pickupLabel),
      passengersLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "passengersLabel", copy.booking.passengersLabel),
      notesLabel: applyText(lookup, locale, fallbackLocale, "booking", "result", "notesLabel", copy.booking.notesLabel),
      waitingTitle: applyText(lookup, locale, fallbackLocale, "booking", "empty", "waitingTitle", copy.booking.waitingTitle),
      waitingDescription: applyText(lookup, locale, fallbackLocale, "booking", "empty", "waitingDescription", copy.booking.waitingDescription),
      noResultTitle: applyText(lookup, locale, fallbackLocale, "booking", "empty", "noResultTitle", copy.booking.noResultTitle),
      noResultDescription: applyText(lookup, locale, fallbackLocale, "booking", "empty", "noResultDescription", copy.booking.noResultDescription),
      reservationLabel: applyText(lookup, locale, fallbackLocale, "booking", "empty", "reservationLabel", copy.booking.reservationLabel),
    },
  };
}

export async function getLocalizedPublicSiteData(
  panel: BusinessPanelData | null,
  requestedLocale?: string | null,
): Promise<PublicSiteLocalization | null> {
  if (!panel?.business) {
    return null;
  }

  const availableLocales = getSupportedLocaleCodes(panel.locales);
  const fallbackLocale = getFallbackLocale(panel, availableLocales);
  const requested = normalizeLanguageCode(requestedLocale);
  const locale = requested && availableLocales.includes(requested) ? requested : fallbackLocale;

  const translatedPanel = clonePanel(panel);
  const revision = await getLatestPublishedRevisionForBusiness(panel.business.id);
  const translations = revision
    ? await getPublishedBusinessTranslationsByBusinessId(panel.business.id)
    : [];
  const lookup = buildTranslationDraftLookup(translations as TranslationDraftRecord[]);
  const business = translatedPanel.business;

  if (!business) {
    return null;
  }

  translatedPanel.business = {
    ...business,
    name: applyText(
      lookup,
      locale,
      fallbackLocale,
      "company",
      "business",
      "name",
      business.name,
    ),
  };
  translatedPanel.profile = {
    ...translatedPanel.profile,
    heroTitle: applyText(
      lookup,
      locale,
      fallbackLocale,
      "hero",
      "profile",
      "heroTitle",
      translatedPanel.profile.heroTitle,
    ),
    heroSubtitle: applyText(
      lookup,
      locale,
      fallbackLocale,
      "hero",
      "profile",
      "heroSubtitle",
      translatedPanel.profile.heroSubtitle,
    ),
    heroButtonText: applyText(
      lookup,
      locale,
      fallbackLocale,
      "hero",
      "profile",
      "heroButtonText",
      translatedPanel.profile.heroButtonText,
    ),
  };
  translatedPanel.services = translatedPanel.services.map((item) => ({
    ...item,
    title: applyText(lookup, locale, fallbackLocale, "service", item.id, "title", item.title),
    description: applyText(
      lookup,
      locale,
      fallbackLocale,
      "service",
      item.id,
      "description",
      item.description,
    ),
  }));
  translatedPanel.vehicles = translatedPanel.vehicles.map((item) => ({
    ...item,
    title: applyText(lookup, locale, fallbackLocale, "vehicle", item.id, "title", item.title),
    description: applyText(
      lookup,
      locale,
      fallbackLocale,
      "vehicle",
      item.id,
      "description",
      item.description,
    ),
  }));
  translatedPanel.routes = translatedPanel.routes.map((item) => ({
    ...item,
    title: applyText(lookup, locale, fallbackLocale, "route", item.id, "title", item.title),
    description: applyText(
      lookup,
      locale,
      fallbackLocale,
      "route",
      item.id,
      "description",
      item.description,
    ),
  }));
  translatedPanel.blogs = translatedPanel.blogs.map((item) => ({
    ...item,
    title: applyText(lookup, locale, fallbackLocale, "blog", item.id, "title", item.title),
    excerpt: applyText(
      lookup,
      locale,
      fallbackLocale,
      "blog",
      item.id,
      "excerpt",
      item.excerpt,
    ),
    content: applyText(
      lookup,
      locale,
      fallbackLocale,
      "blog",
      item.id,
      "content",
      item.content,
    ),
  }));
  translatedPanel.seo = {
    ...translatedPanel.seo,
    metaTitle: applyText(
      lookup,
      locale,
      fallbackLocale,
      "seo",
      "seo",
      "metaTitle",
      translatedPanel.seo.metaTitle,
    ),
    metaDescription: applyText(
      lookup,
      locale,
      fallbackLocale,
      "seo",
      "seo",
      "metaDescription",
      translatedPanel.seo.metaDescription,
    ),
  };

  return {
    locale,
    fallbackLocale,
    isRtl: isRTLLanguage(locale),
    availableLocales: panel.locales.filter((item) => item.active),
    panel: translatedPanel,
    copy: localizeCopyField(lookup, locale, fallbackLocale, DEFAULT_PUBLIC_COPY),
  };
}
