export type TranslationSection =
  | "company"
  | "hero"
  | "service"
  | "vehicle"
  | "route"
  | "blog"
  | "seo"
  | "menus"
  | "publicForm"
  | "voucher"
  | "booking";

export type TranslationFieldKey =
  | "name"
  | "heroTitle"
  | "heroSubtitle"
  | "heroButtonText"
  | "title"
  | "description"
  | "excerpt"
  | "content"
  | "metaTitle"
  | "metaDescription"
  | "home"
  | "services"
  | "vehicles"
  | "routes"
  | "blogLabel"
  | "contact"
  | "quote"
  | "booking"
  | "languages"
  | "customerName"
  | "phone"
  | "email"
  | "message"
  | "submit"
  | "sending"
  | "success"
  | "error"
  | "mailSubject"
  | "mailGreeting"
  | "mailReservationNo"
  | "mailDateTime"
  | "mailPhone"
  | "mailOrigin"
  | "mailDestination"
  | "mailVoucherLink"
  | "mailClosing"
  | "whatsappGreeting"
  | "whatsappReady"
  | "whatsappReservationNo"
  | "whatsappDateTime"
  | "whatsappOriginDestination"
  | "whatsappVoucher"
  | "eyebrow"
  | "searchPlaceholder"
  | "searchButton"
  | "openVoucher"
  | "statusLabel"
  | "paymentLabel"
  | "dateLabel"
  | "timeLabel"
  | "originLabel"
  | "destinationLabel"
  | "vehicleLabel"
  | "pickupLabel"
  | "passengersLabel"
  | "notesLabel"
  | "waitingTitle"
  | "waitingDescription"
  | "noResultTitle"
  | "noResultDescription"
  | "reservationLabel";

export type TranslationDraftRecord = {
  id: string;
  businessId: string;
  localeCode: string;
  section: TranslationSection;
  sourceId: string;
  fieldKey: TranslationFieldKey;
  sourceText: string;
  translatedText: string;
  createdAt: string;
  updatedAt: string;
};

export type PublishedTranslationRecord = TranslationDraftRecord & {
  revisionId: string;
};

export type SectionTranslationSeed = {
  section: TranslationSection;
  sourceId: string;
  fieldKey: TranslationFieldKey;
  sourceText: string;
};

export const TRANSLATION_SECTIONS: Array<{
  section: TranslationSection;
  label: string;
  description: string;
}> = [
  {
    section: "company",
    label: "Firma bilgileri",
    description: "Business adı ve kurumsal giriş metinleri.",
  },
  {
    section: "hero",
    label: "Hero",
    description: "Ana sayfa başlığı, alt başlığı ve CTA metni.",
  },
  {
    section: "service",
    label: "Hizmetler",
    description: "Hizmet başlığı ve açıklamaları.",
  },
  {
    section: "vehicle",
    label: "Araçlar",
    description: "Araç başlığı ve açıklamaları.",
  },
  {
    section: "route",
    label: "Rotalar",
    description: "Rota başlığı ve açıklamaları.",
  },
  {
    section: "blog",
    label: "Blog",
    description: "Blog başlığı, özeti ve içerik metni.",
  },
  {
    section: "seo",
    label: "SEO",
    description: "Meta başlık ve açıklama metinleri.",
  },
  {
    section: "menus",
    label: "Menüler",
    description: "Public navigasyon metinleri.",
  },
  {
    section: "publicForm",
    label: "Public form etiketleri",
    description: "Teklif formu alan adları ve aksiyon metinleri.",
  },
  {
    section: "voucher",
    label: "Voucher metinleri",
    description: "Mail ve WhatsApp voucher şablonları.",
  },
  {
    section: "booking",
    label: "Public booking metinleri",
    description: "Rezervasyon takip sayfası metinleri.",
  },
];

export const SECTION_FIELD_LABELS: Record<
  TranslationSection,
  Partial<Record<TranslationFieldKey, string>>
> = {
  company: {
    name: "Firma adı",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "",
    description: "",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
  },
  hero: {
    name: "",
    heroTitle: "Hero başlığı",
    heroSubtitle: "Hero alt başlığı",
    heroButtonText: "Buton metni",
    title: "",
    description: "",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
  },
  service: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "Başlık",
    description: "Açıklama",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
  },
  vehicle: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "Başlık",
    description: "Açıklama",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
  },
  route: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "Başlık",
    description: "Açıklama",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
  },
  blog: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "Başlık",
    description: "",
    excerpt: "Özet",
    content: "İçerik",
    metaTitle: "",
    metaDescription: "",
  },
  seo: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "",
    description: "",
    excerpt: "",
    content: "",
    metaTitle: "Meta başlık",
    metaDescription: "Meta açıklama",
  },
  menus: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "",
    description: "",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
    home: "Ana sayfa",
    services: "Hizmetler",
    vehicles: "Araçlar",
    routes: "Rotalar",
    blogLabel: "Blog",
    contact: "İletişim",
    quote: "Teklif al",
    booking: "Rezervasyon takibi",
    languages: "Diller",
  },
  publicForm: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "Teklif al",
    description: "Kısa form ile talebinizi bırakın, size geri dönelim.",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
    customerName: "Ad Soyad",
    phone: "Telefon",
    email: "E-posta",
    message: "Mesaj",
    submit: "Teklif gönder",
    sending: "Gönderiliyor...",
    success: "Talebiniz alındı.",
    error: "Gönderim başarısız.",
  },
  voucher: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "",
    description: "",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
    mailSubject: "Rezervasyon Onayı",
    mailGreeting: "Merhaba",
    mailReservationNo: "Rezervasyon No",
    mailDateTime: "Tarih/Saat",
    mailPhone: "Telefon",
    mailOrigin: "Nereden",
    mailDestination: "Nereye",
    mailVoucherLink: "Voucher Link",
    mailClosing: "Saygılarımızla",
    whatsappGreeting: "Merhaba",
    whatsappReady: "rezervasyonunuz hazır.",
    whatsappReservationNo: "Rezervasyon No",
    whatsappDateTime: "Tarih/Saat",
    whatsappOriginDestination: "Nereden/Nereye",
    whatsappVoucher: "Voucher",
  },
  booking: {
    name: "",
    heroTitle: "",
    heroSubtitle: "",
    heroButtonText: "",
    title: "Rezervasyon kodu veya telefon ile sorgula",
    description: "Sadece bu business için kayıtlı rezervasyonlar listelenir. Başka business verisi gösterilmez.",
    excerpt: "",
    content: "",
    metaTitle: "",
    metaDescription: "",
    eyebrow: "Rezervasyon takibi",
    searchPlaceholder: "Rezervasyon kodu veya telefon",
    searchButton: "Sorgula",
    openVoucher: "Voucher aç",
    statusLabel: "Rezervasyon durumu",
    paymentLabel: "Ödeme durumu",
    dateLabel: "Tarih",
    timeLabel: "Saat",
    originLabel: "Nereden",
    destinationLabel: "Nereye",
    vehicleLabel: "Araç",
    pickupLabel: "Pickup bilgisi",
    passengersLabel: "Yolcu bilgisi",
    notesLabel: "Not",
    waitingTitle: "Arama bekleniyor",
    waitingDescription: "Rezervasyon kodunu ya da telefon numarasını girin. Son kayıtlar otomatik listelenmez.",
    noResultTitle: "Rezervasyon bulunamadı",
    noResultDescription: "Girilen rezervasyon kodu veya telefon numarası ile eşleşen kayıt yok.",
    reservationLabel: "Rezervasyon",
  },
};

export function getSectionFieldOrder(section: TranslationSection) {
  switch (section) {
    case "company":
      return ["name"] as const;
    case "hero":
      return ["heroTitle", "heroSubtitle", "heroButtonText"] as const;
    case "service":
    case "vehicle":
    case "route":
      return ["title", "description"] as const;
    case "blog":
      return ["title", "excerpt", "content"] as const;
    case "seo":
      return ["metaTitle", "metaDescription"] as const;
    case "menus":
      return ["home", "services", "vehicles", "routes", "blogLabel", "contact", "quote", "booking", "languages"] as const;
    case "publicForm":
      return ["title", "description", "customerName", "phone", "email", "message", "submit", "sending", "success", "error"] as const;
    case "voucher":
      return [
        "mailSubject",
        "mailGreeting",
        "mailReservationNo",
        "mailDateTime",
        "mailPhone",
        "mailOrigin",
        "mailDestination",
        "mailVoucherLink",
        "mailClosing",
        "whatsappGreeting",
        "whatsappReady",
        "whatsappReservationNo",
        "whatsappDateTime",
        "whatsappOriginDestination",
        "whatsappVoucher",
      ] as const;
    case "booking":
      return [
        "eyebrow",
        "title",
        "description",
        "searchPlaceholder",
        "searchButton",
        "openVoucher",
        "statusLabel",
        "paymentLabel",
        "dateLabel",
        "timeLabel",
        "originLabel",
        "destinationLabel",
        "vehicleLabel",
        "pickupLabel",
        "passengersLabel",
        "notesLabel",
        "waitingTitle",
        "waitingDescription",
        "noResultTitle",
        "noResultDescription",
        "reservationLabel",
      ] as const;
  }
}
