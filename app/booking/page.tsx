import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getActiveBusinessByDomain } from "@/lib/business";
import { listReservations } from "@/lib/reservation-service";
import {
  EmptyState,
  PublicSiteShell,
} from "@/components/public-site-shell";
import { getLandingPath, isPlatformHost, normalizeHost } from "@/lib/platform";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BookingPageProps = {
  searchParams: Promise<{ q?: string }>;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDigits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D+/g, "");
}

function matchesReservation(
  query: string,
  reservation: Awaited<ReturnType<typeof listReservations>>[number],
) {
  const normalizedQuery = normalizeText(query);
  const digitQuery = normalizeDigits(query);

  if (!normalizedQuery && !digitQuery) {
    return false;
  }

  const reservationDigits = normalizeDigits(reservation.phone ?? "");
  const code = normalizeText(reservation.id);
  const fallbackCode = normalizeText(reservation.message);

  return (
    code.includes(normalizedQuery) ||
    fallbackCode.includes(normalizedQuery) ||
    normalizeText(reservation.customerName).includes(normalizedQuery) ||
    normalizeText(reservation.phone).includes(normalizedQuery) ||
    normalizeText(reservation.email).includes(normalizedQuery) ||
    normalizeText(reservation.notes).includes(normalizedQuery) ||
    reservationDigits.includes(digitQuery) ||
    (digitQuery.length > 0 && code.includes(digitQuery))
  );
}

function renderValue(value: string | number | null | undefined) {
  const safe = String(value ?? "").trim();
  return safe || "-";
}

function formatPassengers(
  adults: number | null | undefined,
  children: number | null | undefined,
  babies: number | null | undefined,
) {
  return `${Number(adults ?? 0)} yetişkin, ${Number(children ?? 0)} çocuk, ${Number(babies ?? 0)} bebek`;
}

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();
  const host = normalizeHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  if (!host || isPlatformHost(host)) {
    return {
      title: "Rezervasyon Takip",
      description: "Müşteri rezervasyon takip ekranı.",
    };
  }

  const business = await getActiveBusinessByDomain(host);

  if (!business) {
    return {
      title: "Rezervasyon Takip",
      description: "Müşteri rezervasyon takip ekranı.",
    };
  }

  return {
    title: `${business.name} | Rezervasyon Takip`,
    description: "Rezervasyon kodu veya telefon ile takip ekranı.",
  };
}

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const headerStore = await headers();
  const host = normalizeHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  if (!host || isPlatformHost(host)) {
    const session = await getSession();
    redirect(getLandingPath(session?.role ?? null));
  }

  const business = await getActiveBusinessByDomain(host);

  if (!business) {
    notFound();
  }

  const { q = "" } = await searchParams;
  const query = q.trim();
  const reservations = await listReservations(business.id);
  const results = query
    ? reservations.filter((reservation) => matchesReservation(query, reservation))
    : [];

  return (
    <PublicSiteShell business={business}>
      <section className="grid gap-6">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Rezervasyon takibi
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              Rezervasyon kodu veya telefon ile sorgula
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Sadece bu business için kayıtlı rezervasyonlar listelenir. Başka business verisi gösterilmez.
            </p>
          </div>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/booking">
            <input
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              defaultValue={query}
              name="q"
              placeholder="Rezervasyon kodu veya telefon"
              type="search"
            />
            <button
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="submit"
            >
              Sorgula
            </button>
          </form>
        </article>

        {!query ? (
          <EmptyState
            title="Arama bekleniyor"
            description="Rezervasyon kodunu ya da telefon numarasını girin. Son kayıtlar otomatik listelenmez."
          />
        ) : results.length ? (
          <div className="grid gap-4">
            {results.map((reservation) => (
              <article
                key={reservation.id}
                className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Rezervasyon
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
                      {reservation.customerName}
                    </h2>
                    <p className="text-sm text-slate-600">
                      Kod: {reservation.id} | Telefon: {renderValue(reservation.phone)}
                    </p>
                  </div>

                  <Link
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    href={`/app/reservations/${reservation.id}/voucher`}
                  >
                    Voucher aç
                  </Link>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <InfoRow label="Rezervasyon durumu" value={renderValue(reservation.bookingStatus)} />
                  <InfoRow label="Ödeme durumu" value={renderValue(reservation.paymentStatus)} />
                  <InfoRow label="Tarih" value={renderValue(reservation.travelDate)} />
                  <InfoRow label="Saat" value={renderValue(reservation.travelTime)} />
                  <InfoRow label="Nereden" value={renderValue(reservation.origin)} />
                  <InfoRow label="Nereye" value={renderValue(reservation.destination)} />
                  <InfoRow
                    label="Araç"
                    value={renderValue(reservation.vehicleName ?? reservation.vehicleCategory)}
                  />
                  <InfoRow
                    label="Pickup bilgisi"
                    value={[
                      reservation.pickupStatus,
                      reservation.assignedVehicle,
                      reservation.driverName,
                    ]
                      .filter((value) => String(value ?? "").trim())
                      .join(" • ") || "-"}
                  />
                  <InfoRow
                    label="Yolcu bilgisi"
                    value={formatPassengers(
                      reservation.adultCount,
                      reservation.childCount,
                      reservation.babyCount,
                    )}
                  />
                  <InfoRow label="Not" value={renderValue(reservation.notes)} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Rezervasyon bulunamadı"
            description="Girilen rezervasyon kodu veya telefon numarası ile eşleşen kayıt yok."
          />
        )}
      </section>
    </PublicSiteShell>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="text-sm font-semibold leading-6 text-slate-950">{value}</div>
    </div>
  );
}
