import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Transfer SaaS",
    template: "%s | Transfer SaaS",
  },
  description:
    "Sifirdan kurulan, super admin, business admin ve public site yuzeylerine ayrilmis transfer SaaS cekirdegi.",
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
