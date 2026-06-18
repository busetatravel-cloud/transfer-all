export type PanelNavItem = {
  href: string;
  label: string;
  description: string;
};

export const superAdminNav: PanelNavItem[] = [
  {
    href: "/super-admin",
    label: "Dashboard",
    description: "Sistem ozeti ve hizli durum",
  },
  {
    href: "/super-admin#businesses",
    label: "Businesses",
    description: "Firma listesi ve hesaplar",
  },
  {
    href: "/super-admin#settings",
    label: "Settings",
    description: "Paket, domain ve AI plani",
  },
];

export const businessAdminNav: PanelNavItem[] = [
  {
    href: "/app/dashboard",
    label: "Dashboard",
    description: "Firma paneli ozeti",
  },
  {
    href: "/app/company",
    label: "Company",
    description: "Firma bilgileri ve hero",
  },
  {
    href: "/app/domain",
    label: "Domain",
    description: "Domain baglama ve durum",
  },
  {
    href: "/app/media",
    label: "Media",
    description: "Gorsel medya yonetimi",
  },
  {
    href: "/app/services",
    label: "Services",
    description: "Hizmet kayitlari",
  },
  {
    href: "/app/vehicles",
    label: "Vehicles",
    description: "Araç kayitlari",
  },
  {
    href: "/app/routes",
    label: "Routes",
    description: "Rota kayitlari",
  },
  {
    href: "/app/blog",
    label: "Blog",
    description: "Blog icerikleri",
  },
  {
    href: "/app/seo",
    label: "SEO",
    description: "Meta alanlari",
  },
  {
    href: "/app/languages",
    label: "Languages",
    description: "Dil icerikleri",
  },
  {
    href: "/app/reservations",
    label: "Reservations",
    description: "Rezervasyonlar",
  },
  {
    href: "/app/operation",
    label: "Operation",
    description: "Gunluk operasyon",
  },
  {
    href: "/app/finance",
    label: "Finance",
    description: "Tahsilat ve ciro",
  },
  {
    href: "/app/customers",
    label: "Customers",
    description: "CRM ve musteriler",
  },
  {
    href: "/app/password",
    label: "Password",
    description: "Admin sifresi",
  },
];
