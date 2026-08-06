import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { renderToStaticMarkup } from "react-dom/server";

// Faz 14 — Profesyonel Blok Kütüphanesi: pure-logic + gerçek HTML render
// testleri (DB gerektirmez). website-builder-public-render-integration.test.mjs
// ile AYNI jiti tarifi kullanılır: jsx:{runtime:"automatic"} + fsCache:false +
// moduleCache:false, block .tsx dosyalarını react-dom/server ile gerçek HTML'e
// render edebilmek için gereklidir (classic-runtime JSX tanımsız bir global
// `React`'e referans verir; fsCache eski bir transformu servis edebilir).
const jiti = createJiti(import.meta.url, {
  tsconfigPaths: true,
  jsx: { runtime: "automatic", importSource: "react" },
  fsCache: false,
  moduleCache: false,
  alias: {
    "server-only": fileURLToPath(new URL("./support/server-only-stub.mjs", import.meta.url)),
  },
});

const blocks = await jiti.import("../lib/builder/blocks/index.ts");
const { asVariantKey } = await jiti.import("../lib/builder/types.ts");
const { resolvePublicBlockData } = await jiti.import("../lib/builder/public-data-adapter.ts");
const { getTranslatableSectionFields, getTranslatableRepeaters } = await jiti.import("../lib/builder/translatable-fields.ts");

// Ayrı, DB'ye bağlı entegrasyon testi için (asagida) publish-integration
// test dosyalarindaki ile AYNI "jitiData" tarifi: varsayilan cache/jsx
// ayarlari, draft-store/publish-store/public-render gibi registry'ye
// bagimli kodlar icin. jitiJsx (yukarida) ile KARISTIRILMAZ -- ayri bir
// instance, yalnizca bu dosyanin sonundaki tek DB testi icin kullanilir.
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

async function isLocalSupabaseUp() {
  try {
    const res = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/businesses?limit=1`, {
      headers: { apikey: LOCAL_SERVICE_ROLE_KEY, Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}` },
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

const localSupabaseUp = await isLocalSupabaseUp();

const jitiData = createJiti(import.meta.url, {
  tsconfigPaths: true,
  jsx: true,
  alias: {
    "server-only": fileURLToPath(new URL("./support/server-only-stub.mjs", import.meta.url)),
  },
});

await jitiData.import("../lib/builder/blocks/index.ts");
const { getBusinessBuilderDraft, saveBusinessBuilderDraft } = jitiData("../lib/builder/draft-store.ts");
const { publishBuilderDraft, rollbackBuilderPublication } = jitiData("../lib/builder/publish-store.ts");
const { resolvePublishedBuilderPage } = jitiData("../lib/builder/public-render.ts");
const { builderDocumentReducer, createBuilderDraftPersistenceRecord, createInitialBuilderDocumentState } = jitiData(
  "../lib/builder/document-state.ts",
);
const { asBlockKey: asBlockKeyData } = jitiData("../lib/builder/types.ts");

function restHeaders(extra = {}) {
  return {
    apikey: LOCAL_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function restFetch(path, init = {}) {
  return fetch(`${LOCAL_SUPABASE_URL}/rest/v1${path}`, { ...init, headers: restHeaders(init.headers) });
}

async function createTestBusiness(label) {
  const { randomUUID } = await import("node:crypto");
  const suffix = randomUUID();
  const res = await restFetch("/businesses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: `faz14-block-${label}-${suffix}`,
      email: `faz14-block-${label}-${suffix}@example.test`,
      domain: `faz14-block-${label}-${suffix}.example.test`,
    }),
  });
  const bodyText = await res.text();
  assert.equal(res.status, 201, `business insert failed: ${bodyText}`);
  return JSON.parse(bodyText)[0].id;
}

async function deleteTestBusiness(businessId) {
  await restFetch(`/businesses?id=eq.${businessId}`, { method: "DELETE" });
}

function setLocalEnv() {
  process.env.SUPABASE_URL = LOCAL_SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function makeSection(blockKey, variantKey, content, style, responsive = {}) {
  return {
    id: "s1",
    businessId: "b1",
    pageId: "p1",
    blockKey,
    variantKey: asVariantKey(variantKey),
    position: 0,
    active: true,
    content,
    style,
    responsive,
    createdAt: "",
    updatedAt: "",
  };
}

function renderPublic(definition, section, data) {
  const element = definition.PublicRenderer({ section, breakpoint: "desktop", data });
  return renderToStaticMarkup(element);
}

function validateAndRender(definition, variantKey, rawContent, rawStyle, data) {
  const validated = definition.validate({ variantKey: asVariantKey(variantKey), content: rawContent, style: rawStyle, responsive: {} });
  const section = makeSection(definition.key, variantKey, validated.content, validated.style);
  const html = renderPublic(definition, section, data);
  return { validated, html };
}

function fakePanel(overrides = {}) {
  return {
    business: { id: "biz-1", phone: null, whatsapp: null, email: "" },
    profile: { businessId: "biz-1", heroTitle: "", heroSubtitle: "", heroButtonText: "" },
    mediaAssets: [],
    customers: [],
    services: [],
    vehicles: [],
    routes: [],
    blogs: [],
    seo: { businessId: "biz-1", metaTitle: "", metaDescription: "", canonicalUrl: "", defaultLocale: "tr", hreflangEnabled: true },
    locales: [],
    requests: [],
    ...overrides,
  };
}

// ------------------------------------------------------------
// Registry sanity.
// ------------------------------------------------------------

test("Faz 14: all 12 new blocks are registered with correct family/variant keys", () => {
  const expected = {
    hero_slider: blocks.heroSliderBlock,
    gallery: blocks.galleryBlock,
    faq: blocks.faqBlock,
    testimonials: blocks.testimonialsBlock,
    statistics: blocks.statisticsBlock,
    video: blocks.videoBlock,
    trust_badges: blocks.trustBadgesBlock,
    partners: blocks.partnersBlock,
    vehicle_showcase: blocks.vehicleShowcaseBlock,
    routes_showcase: blocks.routesShowcaseBlock,
    booking_cta: blocks.bookingCtaBlock,
    contact_info: blocks.contactInfoBlock,
  };

  for (const [key, definition] of Object.entries(expected)) {
    assert.equal(String(definition.key), key);
    assert.ok(definition.variants.length > 0, `${key} must declare at least one variant`);
    assert.ok(typeof definition.validate === "function");
    assert.ok(typeof definition.PreviewRenderer === "function");
    assert.ok(typeof definition.PublicRenderer === "function");
    assert.ok(definition.dragDrop.draggable === true, `${key} must be draggable in the palette`);
  }
});

test("Faz 15: the 10 requested new blocks are integrated into the translation whitelist; Vehicle/Routes Showcase intentionally excluded", () => {
  for (const key of ["hero_slider", "gallery", "faq", "testimonials", "statistics", "video", "trust_badges", "partners", "booking_cta", "contact_info"]) {
    const flat = getTranslatableSectionFields(key);
    const repeaters = getTranslatableRepeaters(key);
    assert.ok(flat.length > 0 || repeaters.length > 0, `${key} must have at least one translatable flat field or repeater`);
  }

  for (const key of ["vehicle_showcase", "routes_showcase"]) {
    assert.deepEqual(getTranslatableSectionFields(key), [], `${key} is intentionally excluded from Faz 15 translation scope (adapter-driven, not in the user's list)`);
    assert.deepEqual(getTranslatableRepeaters(key), [], `${key} must have no repeater translation either`);
  }
});

// ------------------------------------------------------------
// Hero Slider.
// ------------------------------------------------------------

test("Hero Slider: single active slide renders as a static hero, no slider wrapper needed", () => {
  const { html } = validateAndRender(blocks.heroSliderBlock, "fullwidth", {
    slides: [{ id: "s1", title: "Tek Slayt Basligi", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "/contact", align: "left", overlay: "none", active: true, order: 0 }],
  }, {});

  assert.match(html, /<h1/);
  assert.match(html, /Tek Slayt Basligi/);
  assert.equal((html.match(/<h1/g) || []).length, 1, "exactly one h1 for a single slide");
});

test("Hero Slider: multiple slides -- exactly one real h1 (first/active slide), others are non-heading text (no duplicate-H1 SEO issue)", () => {
  const { html } = validateAndRender(blocks.heroSliderBlock, "fullwidth", {
    slides: [
      { id: "s1", title: "Birinci Slayt", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "Git", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "/contact", align: "left", overlay: "dark", active: true, order: 0 },
      { id: "s2", title: "Ikinci Slayt", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "Git", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "/contact", align: "left", overlay: "dark", active: true, order: 1 },
    ],
  }, {});

  assert.equal((html.match(/<h1/g) || []).length, 1, "a slider with N slides must still expose exactly one h1 for SEO");
  assert.match(html, /Birinci Slayt/, "the first (active) slide's real content must be present in the initial server-rendered HTML");
  assert.match(html, /Ikinci Slayt/, "other slides must still be present in the DOM (crawlable), just not as an h1");
});

test("Faz 15: Hero Slider transitions and controls declare motion-reduce/focus-visible variants (accessibility + reduced-motion)", () => {
  const { html } = validateAndRender(blocks.heroSliderBlock, "fullwidth", {
    slides: [
      { id: "s1", title: "Birinci", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "/contact", align: "left", overlay: "dark", active: true, order: 0 },
      { id: "s2", title: "Ikinci", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "/contact", align: "left", overlay: "dark", active: true, order: 1 },
    ],
  }, { showArrows: true, showIndicators: true, transition: "fade" });

  assert.match(html, /motion-reduce:transition-none/, "the fade/slide transition must be neutralized under prefers-reduced-motion");
  assert.match(html, /focus-visible:outline/, "arrow/indicator controls must have a visible keyboard focus state");
});

test("Hero Slider: inactive slides are excluded from the active set; no active slide -> Fallback", () => {
  const { html } = validateAndRender(blocks.heroSliderBlock, "fullwidth", {
    slides: [{ id: "s1", title: "Gizli", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "", primaryButtonHref: "/quote", secondaryButtonText: "", secondaryButtonHref: "/contact", align: "left", overlay: "none", active: false, order: 0 }],
  }, {});
  assert.doesNotMatch(html, /Gizli/);
});

test("Hero Slider: unsafe slide href falls back to the safe default, out-of-range duration is clamped, invalid transition falls back to fade", () => {
  const { validated } = validateAndRender(blocks.heroSliderBlock, "fullwidth", {
    slides: [{ id: "s1", title: "T", subtitle: "", description: "", desktopImageSrc: "", mobileImageSrc: "", primaryButtonText: "Git", primaryButtonHref: "javascript:alert(1)", secondaryButtonText: "", secondaryButtonHref: "", align: "left", overlay: "none", active: true, order: 0 }],
  }, { durationMs: 999999, transition: "spin" });

  assert.equal(validated.content.slides[0].primaryButtonHref, "/quote", "unsafe href scheme must fall back to the safe default");
  assert.equal(validated.style.durationMs, 20000, "durationMs must be clamped to the max");
  assert.equal(validated.style.transition, "fade", "invalid transition enum must fall back to fade");
});

// ------------------------------------------------------------
// Gallery.
// ------------------------------------------------------------

test("Gallery: real data adapter maps only ready media assets, sorted, capped, never leaks placeholder/failed assets", () => {
  const panel = fakePanel({
    mediaAssets: [
      { id: "m3", businessId: "biz-1", kind: "vehicle_interior", sourceUrl: "https://cdn.test/3.jpg", storagePath: "", altText: "Interior", metadata: null, status: "ready", sortOrder: 2, createdAt: "2024-01-03", updatedAt: "" },
      { id: "m1", businessId: "biz-1", kind: "hero", sourceUrl: "https://cdn.test/1.jpg", storagePath: "", altText: "Hero", metadata: null, status: "ready", sortOrder: 0, createdAt: "2024-01-01", updatedAt: "" },
      { id: "m2", businessId: "biz-1", kind: "logo", sourceUrl: "https://cdn.test/2.jpg", storagePath: "", altText: "", metadata: { altText: "Logo alt" }, status: "placeholder", sortOrder: 1, createdAt: "2024-01-02", updatedAt: "" },
    ],
  });

  const data = resolvePublicBlockData("gallery", {}, panel, { pageKey: "home" });
  assert.equal(data.items.length, 2, "placeholder-status assets must be excluded");
  assert.equal(data.items[0].id, "m1", "must be sorted by sortOrder");
  assert.equal(data.items[0].altText, "Hero");
});

test("Gallery: empty data -> Fallback with configured empty-state text; carousel variant renders a scroll-snap track", () => {
  const emptyHtml = renderPublic(blocks.galleryBlock, makeSection("gallery", "grid", blocks.galleryBlock.defaultContent(), blocks.galleryBlock.defaultStyle()), { items: [] });
  assert.match(emptyHtml, /Bu işletme için henüz medya yüklenmedi/);

  const carouselHtml = renderPublic(
    blocks.galleryBlock,
    makeSection("gallery", "carousel", blocks.galleryBlock.defaultContent(), blocks.galleryBlock.defaultStyle()),
    { items: [{ id: "g1", imageSrc: "https://cdn.test/a.jpg", altText: "a", caption: "" }] },
  );
  assert.match(carouselHtml, /snap-x/);
  assert.match(carouselHtml, /data-ps-gallery-item="true"/, "lightbox-ready marker must be present");
});

// ------------------------------------------------------------
// FAQ.
// ------------------------------------------------------------

test("FAQ: renders accessible <details>/<summary> accordion and FAQPage structured data, without dangerouslySetInnerHTML", () => {
  const { html } = validateAndRender(blocks.faqBlock, "accordion", {
    items: [
      { id: "f1", question: "Soru 1?", answer: "Cevap 1.", active: true, order: 0 },
      { id: "f2", question: "Gizli soru", answer: "x", active: false, order: 1 },
    ],
  }, {});

  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /Soru 1\?/);
  assert.doesNotMatch(html, /Gizli soru/, "inactive FAQ items must not render");
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, /"@type":"Question"/);
});

test("FAQ: source file never uses dangerouslySetInnerHTML", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("../lib/builder/blocks/faq.tsx", import.meta.url), "utf8"));
  assert.doesNotMatch(source, /dangerouslySetInnerHTML\s*=/, "must not use the JSX prop (a mention of the term in a comment is fine)");
});

// ------------------------------------------------------------
// Statistics.
// ------------------------------------------------------------

test("Statistics: value is clamped to a sane range, inactive/empty-label items excluded, columns clamped", () => {
  const { validated, html } = validateAndRender(blocks.statisticsBlock, "row", {
    items: [
      { id: "st1", value: 99999999, suffix: "+", label: "Transfer", order: 0, active: true },
      { id: "st2", value: -5, suffix: "", label: "", order: 1, active: true },
    ],
  }, { columns: 99 });

  assert.equal(validated.content.items[0].value, 10_000_000, "value must be clamped to the max");
  assert.equal(validated.style.columns, 5, "columns must be clamped to the max");
  assert.match(html, /Transfer/);
});

// ------------------------------------------------------------
// Video.
// ------------------------------------------------------------

test("Video: embed URL whitelist rejects arbitrary hosts and non-https, accepts YouTube/Vimeo, poster rejects unsafe schemes", () => {
  const rejectedHost = blocks.videoBlock.validate({ variantKey: asVariantKey("standard"), content: { embedUrl: "https://evil.example.com/embed" }, style: {}, responsive: {} });
  assert.equal(rejectedHost.content.embedUrl, "", "unknown host must be rejected -> no video");

  const rejectedScheme = blocks.videoBlock.validate({ variantKey: asVariantKey("standard"), content: { embedUrl: "http://www.youtube.com/embed/x" }, style: {}, responsive: {} });
  assert.equal(rejectedScheme.content.embedUrl, "", "non-https must be rejected even for a whitelisted host");

  const accepted = blocks.videoBlock.validate({ variantKey: asVariantKey("standard"), content: { embedUrl: "https://www.youtube-nocookie.com/embed/xyz" }, style: {}, responsive: {} });
  assert.equal(accepted.content.embedUrl, "https://www.youtube-nocookie.com/embed/xyz");

  const unsafePoster = blocks.videoBlock.validate({ variantKey: asVariantKey("standard"), content: { posterImage: "javascript:alert(1)" }, style: {}, responsive: {} });
  assert.equal(unsafePoster.content.posterImage, "", "javascript: poster image must be rejected");
});

test("Video: no embed URL -> Fallback; with embed URL -> poster/play button rendered, no iframe until clicked", () => {
  const empty = validateAndRender(blocks.videoBlock, "standard", {}, {});
  assert.match(empty.html, /Henüz bir video bağlantısı eklenmedi/);

  const withVideo = validateAndRender(blocks.videoBlock, "standard", { embedUrl: "https://www.youtube-nocookie.com/embed/xyz" }, {});
  assert.doesNotMatch(withVideo.html, /<iframe/, "the heavy embed iframe must NOT be present in the initial server-rendered HTML");
  assert.match(withVideo.html, /<button/);
});

// ------------------------------------------------------------
// Testimonials.
// ------------------------------------------------------------

test("Testimonials: rating clamped to 1-5, inactive/incomplete items excluded, carousel variant uses scroll-snap", () => {
  const { validated, html } = validateAndRender(blocks.testimonialsBlock, "carousel", {
    items: [
      { id: "t1", name: "Ayse", quote: "Harika hizmet", rating: 99, location: "", avatarSrc: "", date: "", active: true, order: 0 },
      { id: "t2", name: "", quote: "isimsiz", rating: 5, location: "", avatarSrc: "", date: "", active: true, order: 1 },
    ],
  }, {});

  assert.equal(validated.content.items[0].rating, 5, "rating must be clamped to the max of 5");
  assert.match(html, /Ayse/);
  assert.doesNotMatch(html, /isimsiz/, "an item missing a name must not render");
  assert.match(html, /snap-x/);
});

// ------------------------------------------------------------
// Trust Badges / Partners (shared implementation).
// ------------------------------------------------------------

for (const key of ["trust_badges", "partners"]) {
  test(`${key}: unsafe href/logoSrc rejected, monochrome mode applies grayscale class, empty -> Fallback`, () => {
    const definition = key === "trust_badges" ? blocks.trustBadgesBlock : blocks.partnersBlock;

    const validated = definition.validate({
      variantKey: asVariantKey("grid"),
      content: { items: [{ id: "b1", label: "Rozet", logoSrc: "javascript:alert(1)", href: "javascript:alert(2)", altText: "Rozet", active: true, order: 0 }] },
      style: {},
      responsive: {},
    });
    assert.equal(validated.content.items[0].logoSrc, "", "unsafe logoSrc must be rejected");
    assert.equal(validated.content.items[0].href, "", "unsafe href must be rejected");

    const html = renderPublic(definition, makeSection(definition.key, "grid", { eyebrow: "", title: "", items: [{ id: "b1", label: "Rozet", logoSrc: "", href: "", altText: "Rozet", active: true, order: 0 }] }, { mode: "monochrome" }), undefined);
    assert.match(html, /grayscale/);

    const emptyHtml = renderPublic(definition, makeSection(definition.key, "grid", { eyebrow: "", title: "", items: [] }, { mode: "color" }), undefined);
    assert.match(emptyHtml, /border-dashed|Henüz/);
  });
}

// ------------------------------------------------------------
// Vehicle / Routes Showcase.
// ------------------------------------------------------------

test("Vehicle Showcase: real adapter maps only active vehicles, sorted/capped; capacity/luggage are absent (not fabricated) from real data", () => {
  const panel = fakePanel({
    vehicles: [
      { id: "v2", businessId: "biz-1", slug: "vito", title: "Mercedes Vito", description: "d2", sortOrder: 1, active: true },
      { id: "v1", businessId: "biz-1", slug: "sprinter", title: "Mercedes Sprinter", description: "d1", sortOrder: 0, active: true },
      { id: "v3", businessId: "biz-1", slug: "old", title: "Pasif Arac", description: "d3", sortOrder: 2, active: false },
    ],
  });

  const data = resolvePublicBlockData("vehicle_showcase", { maxItems: 6 }, panel, { pageKey: "home" });
  assert.equal(data.items.length, 2, "inactive vehicle must be excluded");
  assert.equal(data.items[0].title, "Mercedes Sprinter", "must be sorted by sortOrder");
  assert.equal(data.items[0].capacity, undefined, "capacity does not exist in the real schema -- must never be fabricated");
  assert.equal(data.items[0].luggage, undefined);

  const html = renderPublic(blocks.vehicleShowcaseBlock, makeSection("vehicle_showcase", "grid", blocks.vehicleShowcaseBlock.defaultContent(), blocks.vehicleShowcaseBlock.defaultStyle()), data);
  assert.match(html, /Mercedes Sprinter/);
  assert.doesNotMatch(html, /Pasif Arac/);
});

test("Routes Showcase: real adapter maps only active routes; priceLabel/durationLabel absent from real data, present only in admin sample data", () => {
  const panel = fakePanel({
    routes: [{ id: "r1", businessId: "biz-1", slug: "airport-city", title: "Havalimani - Sehir Merkezi", description: "d", sortOrder: 0, active: true }],
  });

  const data = resolvePublicBlockData("routes_showcase", { maxItems: 6 }, panel, { pageKey: "home" });
  assert.equal(data.items[0].priceLabel, undefined);
  assert.equal(data.items[0].durationLabel, undefined);

  const html = renderPublic(blocks.routesShowcaseBlock, makeSection("routes_showcase", "grid", blocks.routesShowcaseBlock.defaultContent(), blocks.routesShowcaseBlock.defaultStyle()), { items: [{ id: "r1", title: "Sample Route", description: "d", href: "/routes/r1", priceLabel: "1000 TL", durationLabel: "30 dk" }] });
  assert.match(html, /1000 TL/, "when priceLabel IS present (e.g. admin sample data), it must render");
});

// ------------------------------------------------------------
// Booking CTA / Contact Info -- real-data gating (the core security property).
// ------------------------------------------------------------

test("Booking CTA: WhatsApp/phone buttons never render unless the REAL business data provides a number, even if content wants to show them", () => {
  const contentWantsBoth = { ...blocks.bookingCtaBlock.defaultContent(), showWhatsapp: true, showPhone: true };

  const noRealNumbers = renderPublic(blocks.bookingCtaBlock, makeSection("booking_cta", "centered", contentWantsBoth, blocks.bookingCtaBlock.defaultStyle()), { whatsappHref: null, phoneHref: null });
  assert.doesNotMatch(noRealNumbers, /wa\.me|tel:/, "no real number on file -> no WhatsApp/phone button, regardless of content flags");

  const withRealNumbers = renderPublic(blocks.bookingCtaBlock, makeSection("booking_cta", "centered", contentWantsBoth, blocks.bookingCtaBlock.defaultStyle()), { whatsappHref: "https://wa.me/905551112233", phoneHref: "tel:+905551112233" });
  assert.match(withRealNumbers, /wa\.me\/905551112233/);
  assert.match(withRealNumbers, /tel:\+905551112233/);
});

test("Booking CTA real adapter: phone/whatsapp hrefs are derived only from the business record, digits-only for wa.me", () => {
  const panel = fakePanel({ business: { id: "biz-1", phone: "+90 555 111 22 33", whatsapp: "+90 555 111 22 33", email: "" } });
  const data = resolvePublicBlockData("booking_cta", {}, panel, { pageKey: "home" });
  assert.equal(data.phoneHref, "tel:+90 555 111 22 33");
  assert.equal(data.whatsappHref, "https://wa.me/905551112233");

  const noContact = resolvePublicBlockData("booking_cta", {}, fakePanel(), { pageKey: "home" });
  assert.equal(noContact.whatsappHref, null);
  assert.equal(noContact.phoneHref, null);
});

test("Contact Info: phone/WhatsApp/email are gated on real business data; social links reject unsafe hrefs", () => {
  const content = { ...blocks.contactInfoBlock.defaultContent(), socialLinks: [{ id: "soc1", platform: "Instagram", href: "javascript:alert(1)", active: true, order: 0 }] };
  const validated = blocks.contactInfoBlock.validate({ variantKey: asVariantKey("card"), content, style: {}, responsive: {} });
  assert.equal(validated.content.socialLinks[0].href, "", "unsafe social link href must be rejected");

  const withoutData = renderPublic(blocks.contactInfoBlock, makeSection("contact_info", "card", blocks.contactInfoBlock.defaultContent(), blocks.contactInfoBlock.defaultStyle()), { phoneHref: null, phoneLabel: null, whatsappHref: null, emailHref: null, emailLabel: null });
  assert.doesNotMatch(withoutData, /tel:|wa\.me|mailto:/);

  const withData = renderPublic(blocks.contactInfoBlock, makeSection("contact_info", "card", blocks.contactInfoBlock.defaultContent(), blocks.contactInfoBlock.defaultStyle()), { phoneHref: "tel:+905551112233", phoneLabel: "+90 555 111 22 33", whatsappHref: "https://wa.me/905551112233", emailHref: "mailto:info@example.com", emailLabel: "info@example.com" });
  assert.match(withData, /mailto:info@example\.com/);
});

test("Contact Info real adapter: two different businesses never cross-contaminate contact data", () => {
  const panelA = fakePanel({ business: { id: "biz-a", phone: "+90 111", whatsapp: "+90 111", email: "a@example.test" } });
  const panelB = fakePanel({ business: { id: "biz-b", phone: "+90 222", whatsapp: "+90 222", email: "b@example.test" } });

  const dataA = resolvePublicBlockData("contact_info", {}, panelA, { pageKey: "contact" });
  const dataB = resolvePublicBlockData("contact_info", {}, panelB, { pageKey: "contact" });

  assert.equal(dataA.emailLabel, "a@example.test");
  assert.equal(dataB.emailLabel, "b@example.test");
  assert.notEqual(dataA.emailLabel, dataB.emailLabel);
});

// ------------------------------------------------------------
// Real local Supabase integration: a NEW Faz 14 block survives the existing
// publish + rollback pipeline unchanged (documents are opaque JSON, but this
// proves it end-to-end rather than just asserting it by architecture).
// ------------------------------------------------------------

test(
  "Faz 14: a new block (hero_slider) added to a page survives real publish, edit, and rollback",
  { skip: localSupabaseUp ? false : "local Supabase (127.0.0.1:54321) is not running — run `supabase start` first" },
  async (t) => {
    setLocalEnv();

    await t.test("hero_slider publishes with its default content and is readable back after publish", async () => {
      const businessId = await createTestBusiness("hero-slider-publish");
      try {
        const seeded = await getBusinessBuilderDraft(businessId);
        const baseState = createInitialBuilderDocumentState();
        const homeId = baseState.draft.workspace.pages[0].id;
        const withNewBlock = builderDocumentReducer(baseState, {
          type: "add-block",
          pageId: homeId,
          blockKey: asBlockKeyData("hero_slider"),
        });
        const document = createBuilderDraftPersistenceRecord(withNewBlock);

        const saved = await saveBusinessBuilderDraft({
          businessId,
          document,
          expectedVersion: seeded.draftVersion,
          updatedBy: null,
        });

        const v1 = await publishBuilderDraft({
          businessId,
          expectedDraftVersion: saved.draftVersion,
          expectedPublishedVersion: saved.basePublishedVersion,
        });

        const resolved = await resolvePublishedBuilderPage(businessId, "home");
        assert.ok(resolved);
        const sliderSection = resolved.page.sections.find((section) => section.blockKey === "hero_slider");
        assert.ok(sliderSection, "the newly added hero_slider section must be present in the published page");
        assert.ok(Array.isArray(sliderSection.content.slides) && sliderSection.content.slides.length > 0);

        const draftAfterV1 = await getBusinessBuilderDraft(businessId);
        const homeAfterV1 = draftAfterV1.document.workspace.pages.find((page) => page.key === "home");
        const heroSliderInDraft = homeAfterV1.sections.find((section) => section.blockKey === "hero_slider");
        const editedWorkspace = structuredClone(draftAfterV1.document.workspace);
        const editedHome = editedWorkspace.pages.find((page) => page.key === "home");
        const editedSlider = editedHome.sections.find((section) => section.blockKey === "hero_slider");
        editedSlider.content.slides[0].title = "Rollback testi icin degistirilen slayt basligi";
        const editedDocument = { version: draftAfterV1.document.version, savedAt: new Date().toISOString(), workspace: editedWorkspace };

        const savedV2 = await saveBusinessBuilderDraft({
          businessId,
          document: editedDocument,
          expectedVersion: draftAfterV1.draftVersion,
          updatedBy: null,
        });
        await publishBuilderDraft({
          businessId,
          expectedDraftVersion: savedV2.draftVersion,
          expectedPublishedVersion: savedV2.basePublishedVersion,
        });

        const resolvedV2 = await resolvePublishedBuilderPage(businessId, "home");
        const sliderV2 = resolvedV2.page.sections.find((section) => section.blockKey === "hero_slider");
        assert.equal(sliderV2.content.slides[0].title, "Rollback testi icin degistirilen slayt basligi");

        const rollback = await rollbackBuilderPublication(businessId, v1.revisionId);
        const resolvedAfterRollback = await resolvePublishedBuilderPage(businessId, "home");
        const sliderAfterRollback = resolvedAfterRollback.page.sections.find((section) => section.blockKey === "hero_slider");
        assert.deepEqual(
          sliderAfterRollback.content.slides,
          heroSliderInDraft.content.slides,
          "after rollback, the public page must show the ORIGINAL (v1) hero_slider content again, not the v2 edit",
        );
        assert.ok(rollback.revisionId);
      } finally {
        await deleteTestBusiness(businessId);
      }
    });
  },
);
