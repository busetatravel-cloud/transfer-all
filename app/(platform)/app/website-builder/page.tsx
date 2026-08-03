import { requireBusinessSession } from "@/lib/auth";
import { WebsiteBuilderShell } from "@/components/builder/admin/website-builder-shell";
import "@/lib/builder/templates/index";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Bu sayfa yalnızca IZOLE bir önizleme/düzenleme çalışma alanıdır (Faz 6).
// Hiçbir şey veritabanına yazılmaz — WebsiteBuilderShell'in tüm state'i
// yalnızca tarayıcı belleğinde yaşar, sayfa yenilendiğinde sıfırlanır.
export default async function WebsiteBuilderPage() {
  await requireBusinessSession();

  return <WebsiteBuilderShell />;
}
