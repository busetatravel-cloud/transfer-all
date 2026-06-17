import type { ReactNode } from "react";
import { PanelShell } from "@/components/panel-shell";
import { businessAdminNav } from "@/lib/navigation";

export default function BusinessLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PanelShell
      accentLabel="Business Admin Panel"
      brand="Firma Paneli"
      summary="Her business sadece kendi verisini yonetir."
      title="Firma bilgileri, talepler ve site icerigi tek panelde, sade bir akista tutulur."
      nav={businessAdminNav}
    >
      {children}
    </PanelShell>
  );
}
