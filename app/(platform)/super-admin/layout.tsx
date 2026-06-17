import type { ReactNode } from "react";
import { PanelShell } from "@/components/panel-shell";
import { superAdminNav } from "@/lib/navigation";

export default function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <PanelShell
      accentLabel="Super Admin Panel"
      brand="Buseta Transfer"
      summary="Sistem sahibi icin sade ve net yonetim alani."
      title="Business hesaplari, paketler ve domain eslesmeleri tek merkezden kontrol edilir."
      nav={superAdminNav}
    >
      {children}
    </PanelShell>
  );
}
