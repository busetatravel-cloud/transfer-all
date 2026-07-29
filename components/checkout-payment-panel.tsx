"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { PaymentProviderKey } from "@/lib/payment-types";
import type { PaymentRecord } from "@/lib/payment-types";
import type { ReservationRecord } from "@/lib/reservation-types";

function formatPaymentStatusLabel(
  status: string | null | undefined,
) {
  switch (String(status ?? "").trim().toLowerCase()) {
    case "paid":
    case "ödendi":
      return "Ödendi";

    case "pending":
    case "bekliyor":
      return "Bekliyor";

    case "failed":
    case "başarısız":
      return "Başarısız";

    case "cancelled":
    case "canceled":
    case "iptal":
      return "İptal";

    case "refunded":
    case "iade":
      return "İade edildi";

    default:
      return String(status ?? "").trim() || "Bekliyor";
  }
}

type Props = {
  reservation: ReservationRecord;
  initialPayment: PaymentRecord | null;
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

function formatMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency ?? "TRY"}`;
}

function text(value: string | number | null | undefined) {
  const safe = String(value ?? "").trim();
  return safe || "-";
}

export function CheckoutPaymentPanel({ reservation, initialPayment }: Props) {
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentRecord | null>(initialPayment);
  const [provider, setProvider] = useState<PaymentProviderKey>(
    initialPayment?.provider ?? "manual",
  );
  const [amount, setAmount] = useState(String(initialPayment?.amount ?? reservation.totalAmount ?? 0));
  const [transactionReference, setTransactionReference] = useState(
    initialPayment?.transactionReference ?? "",
  );
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });

  async function readResponseBody(response: Response) {
    const text = await response.text().catch(() => "");

    if (!text.trim()) {
      return null;
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "saving", message: "Ödeme kaydı oluşturuluyor..." });

    try {
      const response = await fetch("/api/business/payments/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          reservationId: reservation.id,
          provider,
          amount: Number(amount),
          currency: reservation.currency ?? "TRY",
        }),
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            typeof body === "object" && body && "message" in body
              ? String((body as { message?: string }).message ?? "Ödeme kaydı oluşturulamadı.")
              : "Ödeme kaydı oluşturulamadı.",
        });
        return;
      }

      const nextPayment = (body as { payment?: PaymentRecord } | null)?.payment ?? null;
      setPayment(nextPayment);
      setTransactionReference(nextPayment?.transactionReference ?? "");
      setState({
        status: "success",
        message: "Ödeme kaydı oluşturuldu.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Ödeme kaydı oluşturulamadı.",
      });
    }
  }

  async function completePayment() {
    setState({ status: "saving", message: "Ödeme tamamlanıyor..." });

    try {
      const response = await fetch("/api/business/payments/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          paymentId: payment?.id,
          amount: Number(amount),
          transactionReference,
        }),
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        setState({
          status: "error",
          message:
            typeof body === "object" && body && "message" in body
              ? String((body as { message?: string }).message ?? "Ödeme tamamlanamadı.")
              : "Ödeme tamamlanamadı.",
        });
        return;
      }

      const nextPayment = (body as { payment?: PaymentRecord } | null)?.payment ?? null;
      setPayment(nextPayment);
      setTransactionReference(nextPayment?.transactionReference ?? transactionReference);
      setState({
        status: "success",
        message: "Ödeme tamamlandı, rezervasyon güncellendi.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Ödeme tamamlanamadı.",
      });
    }
  }

  const reservationTotal = reservation.totalAmount ?? 0;
  const remainingAmount = Math.max(reservationTotal - Number(amount || 0), 0);
  const isConfirmed =
    payment?.status === "Paid" || reservation.paymentStatus === "Ödendi";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <article className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Rezervasyon özeti</h2>
          <p className="text-sm leading-6 text-slate-600">
            Rezervasyon, yolcu ve fiyat bilgilerini checkout ekranında tek yerde topladık.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <InfoCard label="Yolcu" value={reservation.passengerName ?? reservation.customerName} />
          <InfoCard label="Telefon" value={text(reservation.phone)} />
          <InfoCard label="E-posta" value={text(reservation.email)} />
          <InfoCard label="Rota" value={`${text(reservation.origin)} → ${text(reservation.destination)}`} />
          <InfoCard label="Araç tipi" value={text(reservation.vehicleCategory)} />
          <InfoCard label="Gidiş / Dönüş" value={text(reservation.tripType)} />
          <InfoCard label="Tarih / Saat" value={`${text(reservation.travelDate)} ${text(reservation.travelTime)}`} />
          <InfoCard label="Uçuş numarası" value={text(reservation.flightCode)} />
          <InfoCard label="Otel adı veya adres" value={text(reservation.hotelNameOrAddress)} />
          <InfoCard label="Durum" value={reservation.bookingStatus} />
        </div>

        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
          <InfoCard label="Yetişkin" value={String(reservation.adultCount)} />
          <InfoCard label="Çocuk" value={String(reservation.childCount)} />
          <InfoCard label="Bebek" value={String(reservation.babyCount)} />
        </div>
      </article>

      <article className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Ödeme işlemi</h2>
          <p className="text-sm leading-6 text-slate-600">
            Gerçek provider entegrasyonu gelene kadar burada güvenli bir soyut katman kullanıyoruz.
          </p>
        </div>

        <form className="grid gap-4" onSubmit={createPayment}>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Provider</span>
            <select
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
              value={provider}
              onChange={(event) => setProvider(event.target.value as PaymentProviderKey)}
            >
              <option value="manual">Manual</option>
              <option value="iyzico">iyzico</option>
              <option value="stripe">Stripe</option>
              <option value="paytr">PayTR</option>
              <option value="square">Square</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Tutar</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Transaction reference</span>
            <input
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
              value={transactionReference}
              onChange={(event) => setTransactionReference(event.target.value)}
              placeholder="Provider tarafından üretilecek"
            />
          </label>

          <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <InfoCard label="Rezervasyon toplamı" value={formatMoney(reservationTotal, reservation.currency)} />
            <InfoCard label="İşlem toplamı" value={formatMoney(Number(amount || 0), reservation.currency)} />
            <InfoCard label="Kalan" value={formatMoney(remainingAmount, reservation.currency)} />
            <InfoCard
              label="Ödeme durumu"
              value={payment ? formatPaymentStatusLabel(payment.status) : "Bekleyen ödeme"}
            />
          </div>

          {state.message ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                state.status === "error"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {state.message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="submit"
            >
              Ödeme kaydı oluştur
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void completePayment()}
              disabled={!payment || isConfirmed}
            >
              Ödemeyi tamamla
            </button>
          </div>
        </form>

        {payment ? (
          <div className="rounded-[24px] border border-slate-200 bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Son ödeme kaydı
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-4">
                <span>Provider</span>
                <span className="font-medium text-slate-950">{payment.provider}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Tutar</span>
                <span className="font-medium text-slate-950">
                  {formatMoney(payment.amount, payment.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Status</span>
                <span className="font-medium text-slate-950">
                  {formatPaymentStatusLabel(payment.status)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span>Reference</span>
                <span className="font-medium text-slate-950">
                  {payment.transactionReference ?? "-"}
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}


