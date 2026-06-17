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
    href: "/app",
    label: "Dashboard",
    description: "Firma paneli ozeti",
  },
  {
    href: "/app#content",
    label: "Content",
    description: "Firma bilgileri ve site icerigi",
  },
  {
    href: "/app#requests",
    label: "Requests",
    description: "Gelen talepler",
  },
];
