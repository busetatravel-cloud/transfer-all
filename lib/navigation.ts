export type PanelNavItem = {
  href: string;
  label: string;
  description: string;
};

export const superAdminNav: PanelNavItem[] = [
  {
    href: "/super-admin",
    label: "Dashboard",
    description: "Sistem özeti ve hızlı durum",
  },
  {
    href: "/super-admin/plans",
    label: "Paketler",
    description: "Plan tanımları ve abonelik bağlama",
  },
  {
    href: "/super-admin/system-status",
    label: "Sistem Durumu",
    description: "Sağlık kartları ve placeholder kontroller",
  },
  {
    href: "/super-admin/domains",
    label: "Domainlar",
    description: "Tüm bağlı domainler ve aktivasyon kontrolü",
  },
  {
    href: "/super-admin#businesses",
    label: "Businesses",
    description: "Firma listesi ve hesaplar",
  },
  {
    href: "/super-admin#settings",
    label: "Settings",
    description: "Paket, domain ve AI planı",
  },
];

export const businessAdminNav: PanelNavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    description: "Firma paneli özeti",
  },
  {
    href: "/app/company",
    label: "Company",
    description: "Firma bilgileri ve hero",
  },
  {
    href: "/app/domain",
    label: "Domain",
    description: "Domain bağlama ve durum",
  },
  {
    href: "/app/media",
    label: "Media",
    description: "Görsel medya yönetimi",
  },
  {
    href: "/app/services",
    label: "Services",
    description: "Hizmet kayıtları",
  },
  {
    href: "/app/vehicles",
    label: "Vehicles",
    description: "Araç kayıtları",
  },
  {
    href: "/app/routes",
    label: "Routes",
    description: "Rota kayıtları",
  },
  {
    href: "/app/blog",
    label: "Blog",
    description: "Blog içerikleri",
  },
  {
    href: "/app/seo",
    label: "SEO",
    description: "Meta alanları",
  },
  {
    href: "/app/languages",
    label: "Languages",
    description: "Dil içerikleri",
  },
  {
    href: "/app/publishing",
    label: "Yayın Merkezi",
    description: "Taslak, önizleme ve yayın geçmişi",
  },
  {
    href: "/app/export",
    label: "Export / Yedek",
    description: "CSV önizleme ve kopyalama",
  },
  {
    href: "/app/reservations",
    label: "Reservations",
    description: "Rezervasyonlar",
  },
  {
    href: "/app/tasks",
    label: "Görevler",
    description: "Hatırlatmalar ve iş akışları",
  },
  {
    href: "/app/search",
    label: "Arama",
    description: "Global business araması",
  },
  {
    href: "/app/analytics",
    label: "Analytics",
    description: "Ziyaret ve dönüşüm özeti",
  },
  {
    href: "/app/notifications",
    label: "Bildirimler",
    description: "Okunmamış ve geçmiş bildirimler",
  },
  {
    href: "/app/operation",
    label: "Operation",
    description: "Günlük operasyon",
  },
  {
    href: "/app/finance",
    label: "Finance",
    description: "Tahsilat ve ciro",
  },
  {
    href: "/app/customers",
    label: "Customers",
    description: "CRM ve müşteriler",
  },
  {
    href: "/app/password",
    label: "Password",
    description: "Admin şifresi",
  },
];
