import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Transfer SaaS",
    template: "%s | Transfer SaaS",
  },
  description:
    "Sifirdan kurulan, super admin, business admin ve public site yuzeylerine ayrilmis transfer SaaS cekirdegi.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
