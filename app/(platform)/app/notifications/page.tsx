import { requireBusinessSession } from "@/lib/auth";
import { listNotifications } from "@/lib/notifications";
import { NotificationsModule } from "@/components/notifications-module";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NotificationsPage() {
  const session = await requireBusinessSession();
  const notifications = await listNotifications(session.businessId);

  return (
    <NotificationsModule
      businessId={session.businessId}
      initialNotifications={notifications}
    />
  );
}
