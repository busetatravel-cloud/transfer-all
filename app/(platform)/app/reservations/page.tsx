import { ReservationsModule } from "@/components/reservations-module";
import { requireBusinessSession } from "@/lib/auth";
import { listReservations } from "@/lib/reservation-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReservationsPage() {
  const session = await requireBusinessSession();
  const reservations = await listReservations(session.businessId);

  return (
    <ReservationsModule
      businessId={session.businessId}
      initialReservations={reservations}
    />
  );
}
