export type PublicMenuCopy = {
  home: string;
  services: string;
  vehicles: string;
  routes: string;
  blog: string;
  contact: string;
  quote: string;
  booking: string;
  languages: string;
};

export type PublicFormCopy = {
  title: string;
  description: string;
  customerName: string;
  phone: string;
  email: string;
  message: string;
  submit: string;
  sending: string;
  success: string;
  error: string;
};

export type VoucherCopy = {
  mailSubject: string;
  mailGreeting: string;
  mailReservationNo: string;
  mailDateTime: string;
  mailPhone: string;
  mailOrigin: string;
  mailDestination: string;
  mailVoucherLink: string;
  mailClosing: string;
  whatsappGreeting: string;
  whatsappReady: string;
  whatsappReservationNo: string;
  whatsappDateTime: string;
  whatsappOriginDestination: string;
  whatsappVoucher: string;
};

export type BookingCopy = {
  eyebrow: string;
  title: string;
  description: string;
  searchPlaceholder: string;
  searchButton: string;
  openVoucher: string;
  statusLabel: string;
  paymentLabel: string;
  dateLabel: string;
  timeLabel: string;
  originLabel: string;
  destinationLabel: string;
  vehicleLabel: string;
  pickupLabel: string;
  passengersLabel: string;
  notesLabel: string;
  waitingTitle: string;
  waitingDescription: string;
  noResultTitle: string;
  noResultDescription: string;
  reservationLabel: string;
};

export type PublicCopy = {
  menus: PublicMenuCopy;
  publicForm: PublicFormCopy;
  voucher: VoucherCopy;
  booking: BookingCopy;
};

export const DEFAULT_PUBLIC_COPY: PublicCopy = {
  menus: {
    home: "Ana sayfa",
    services: "Hizmetler",
    vehicles: "Araçlar",
    routes: "Rotalar",
    blog: "Blog",
    contact: "İletişim",
    quote: "Teklif al",
    booking: "Rezervasyon takibi",
    languages: "Diller",
  },
  publicForm: {
    title: "Teklif al",
    description: "Kısa form ile talebinizi bırakın, size geri dönelim.",
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
    eyebrow: "Rezervasyon takibi",
    title: "Rezervasyon kodu veya telefon ile sorgula",
    description: "Sadece bu business için kayıtlı rezervasyonlar listelenir. Başka business verisi gösterilmez.",
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

