"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { ReservationRecord } from "@/lib/reservation-types";
import {
  buildTransferReservationPayload,
  createEmptyTransferReservationFormState,
  formatTripTypeLabel,
  mapTransferReservationFieldErrorsToUi,
  type TransferReservationFieldErrors,
  type TransferReservationFormState,
  TRANSFER_TRIP_TYPES,
} from "@/lib/transfer-reservation-engine";
import {
  PRICING_CURRENCIES,
  type TransferPricingDraft,
  type TransferPricingQuote,
} from "@/lib/pricing-engine";
import { TRANSFER_VEHICLE_CATEGORY_OPTIONS } from "@/lib/pricing-engine";
import {
  CheckboxCard,
  CounterField,
  SelectField,
  TextAreaField,
  TextField,
} from "./transfer-reservation-field";

type Props = {
  businessId: string;
  businessName: string;
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type PricingState = {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
};

function normalizeErrorBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return {
      message: "Rezervasyon kaydedilemedi.",
      fieldErrors: {},
    };
  }

  const payload = body as {
    message?: string;
    error?: string;
    fieldErrors?: Record<string, string>;
  };

  return {
    message: payload.message ?? payload.error ?? "Rezervasyon kaydedilemedi.",
    fieldErrors: payload.fieldErrors ?? {},
  };
}

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

function formatPassengerSummary(form: TransferReservationFormState) {
  return [
    `${Number(form.adults ?? 0)} yetişkin`,
    `${Number(form.children ?? 0)} çocuk`,
    `${Number(form.babies ?? 0)} bebek`,
  ].join(", ");
}

function formatTripSummary(form: TransferReservationFormState) {
  return `${form.origin || "-"} → ${form.destination || "-"}`;
}

function formatExtras(form: TransferReservationFormState) {
  const extras = [
    form.childSeatRequested ? "Çocuk koltuğu" : null,
    form.extraBaggageRequested ? "Ek bagaj" : null,
  ].filter(Boolean);

  return extras.length ? extras.join(" · ") : "Ekstra yok";
}

export function TransferReservationEngine({ businessId, businessName }: Props) {
  const [form, setForm] = useState<TransferReservationFormState>(
    createEmptyTransferReservationFormState(),
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "" });
  const [fieldErrors, setFieldErrors] = useState<TransferReservationFieldErrors>({});
  const [createdReservation, setCreatedReservation] = useState<ReservationRecord | null>(null);
  const [pricingQuote, setPricingQuote] = useState<TransferPricingQuote | null>(null);
  const [pricingState, setPricingState] = useState<PricingState>({
    status: "idle",
    message: "",
  });

  const preview = useMemo(
    () => ({
      route: formatTripSummary(form),
      passengers: formatPassengerSummary(form),
      extras: formatExtras(form),
      tripType: formatTripTypeLabel(form.tripType),
    }),
    [form],
  );

  const pricingDraft = useMemo<TransferPricingDraft>(
    () => ({
      businessId,
      origin: form.origin,
      destination: form.destination,
      travelDate: form.travelDate,
      travelTime: form.travelTime,
      tripType: form.tripType,
      vehicleCategory: form.vehicleCategory,
      currency: form.currency,
      adults: form.adults,
      children: form.children,
      babies: form.babies,
      childSeatRequested: form.childSeatRequested,
      extraBaggageRequested: form.extraBaggageRequested,
      vipGreetingRequested: form.vipGreetingRequested,
      waitingMinutes: form.waitingMinutes,
      airportParkingFee: form.airportParkingFee,
      agencyName: form.agencyName,
      couponCode: form.couponCode,
      discountPercent: form.discountPercent,
      discountAmount: form.discountAmount,
    }),
    [businessId, form],
  );

  const emptyQuote: TransferPricingQuote = {
    basePrice: 0,
    extras: 0,
    discount: 0,
    subtotal: 0,
    tax: 0,
    total: 0,
    currency: (form.currency || "TRY") as TransferPricingQuote["currency"],
    breakdown: [],
  };
  const displayedQuote = pricingQuote ?? emptyQuote;

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setPricingState({ status: "loading", message: "Fiyat hesaplanıyor..." });
        const response = await fetch("/api/business/pricing/calculate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ payload: pricingDraft }),
          signal: controller.signal,
        });
        const body = await readResponseBody(response);

        if (!response.ok) {
          const normalized = normalizeErrorBody(body);
          setPricingQuote(null);
          setPricingState({
            status: "error",
            message: normalized.message,
          });
          return;
        }

        const quote = (body as { quote?: TransferPricingQuote } | null)?.quote ?? null;
        setPricingQuote(quote);
        setPricingState({
          status: "ready",
          message: "",
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPricingQuote(null);
        setPricingState({
          status: "error",
          message: error instanceof Error ? error.message : "Fiyat hesaplanamadı.",
        });
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [pricingDraft]);

  function updateField<K extends keyof TransferReservationFormState>(
    key: K,
    value: TransferReservationFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveState({ status: "saving", message: "Rezervasyon kaydediliyor..." });
    setFieldErrors({});
    setCreatedReservation(null);

    try {
      const payload = buildTransferReservationPayload(form);
      const response = await fetch("/api/business/transfer-reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "create",
          section: "transfer_reservation",
          payload,
        }),
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        const normalized = normalizeErrorBody(body);
        setSaveState({
          status: "error",
          message: normalized.message,
        });
        setFieldErrors(mapTransferReservationFieldErrorsToUi(normalized.fieldErrors));
        return;
      }

      const reservation = (body as { reservation?: ReservationRecord } | null)?.reservation ?? null;

      if (reservation) {
        setCreatedReservation(reservation);
      }

      setSaveState({
        status: "success",
        message: "Rezervasyon başarıyla kaydedildi.",
      });
      setForm(createEmptyTransferReservationFormState());
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Rezervasyon kaydedilemedi.",
      });
    }
  }

  return (
    <section className="grid gap-6" data-business-id={businessId}>
      <article className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#eef2ff_100%)] p-6 shadow-sm lg:p-8">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Transfer Reservation Engine
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              Rezervasyon oluşturma ekranı
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              {businessName} için transfer rezervasyonunu tek formda oluştur. Alanlar, fiyat motoru
              ve ödeme katmanının daha sonra kolayca bağlanacağı şekilde düzenlendi.
            </p>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Canlı önizleme
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              <div className="font-medium text-slate-950">{preview.route}</div>
              <div>{preview.tripType}</div>
              <div>{preview.passengers}</div>
              <div>{preview.extras}</div>
            </div>
          </div>
        </div>
      </article>

      {saveState.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            saveState.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {saveState.message}
        </div>
      ) : null}

      {createdReservation ? (
        <article className="grid gap-3 rounded-[28px] border border-emerald-200 bg-emerald-50 p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Kayıt tamamlandı
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-emerald-950">
            {createdReservation.customerName} için rezervasyon oluşturuldu
          </h2>
          <p className="max-w-3xl text-sm leading-7 text-emerald-900/80">
            Rezervasyon ID: <span className="font-semibold">{createdReservation.id}</span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-emerald-950 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900"
              href={`/app/reservations/${createdReservation.id}/voucher`}
            >
              Voucher aç
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
              href={`/app/checkout/${createdReservation.id}`}
            >
              Checkout aç
            </Link>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100"
              href="/app/reservations"
            >
              Rezervasyon listesi
            </Link>
          </div>
        </article>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Temel bilgiler
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Yolcu, iletişim ve rota bilgileri.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Yolcu adı"
                placeholder="Ad Soyad"
                required
                value={form.passengerName}
                onChange={(value) => updateField("passengerName", value)}
                error={fieldErrors.passengerName}
              />
              <TextField
                label="Telefon"
                placeholder="+90 5xx xxx xx xx"
                required
                value={form.phone}
                onChange={(value) => updateField("phone", value)}
                error={fieldErrors.phone}
              />
              <TextField
                label="E-posta"
                placeholder="ornek@mail.com"
                type="email"
                value={form.email}
                onChange={(value) => updateField("email", value)}
                error={fieldErrors.email}
              />
              <SelectField
                label="Gidiş / Dönüş"
                required
                value={form.tripType}
                onChange={(value) =>
                  updateField(
                    "tripType",
                    TRANSFER_TRIP_TYPES.includes(value as (typeof TRANSFER_TRIP_TYPES)[number])
                      ? (value as TransferReservationFormState["tripType"])
                      : "one_way",
                  )
                }
                error={fieldErrors.tripType}
                options={[
                  { value: "one_way", label: "Tek yön" },
                  { value: "round_trip", label: "Gidiş / Dönüş" },
                ]}
              />
              <TextField
                label="Nereden"
                placeholder="Havalimanı, otel, adres..."
                required
                value={form.origin}
                onChange={(value) => updateField("origin", value)}
                error={fieldErrors.origin}
              />
              <TextField
                label="Nereye"
                placeholder="Hedef otel veya adres"
                required
                value={form.destination}
                onChange={(value) => updateField("destination", value)}
                error={fieldErrors.destination}
              />
              <TextField
                label="Tarih"
                required
                type="date"
                value={form.travelDate}
                onChange={(value) => updateField("travelDate", value)}
                error={fieldErrors.travelDate}
              />
              <TextField
                label="Saat"
                required
                type="time"
                value={form.travelTime}
                onChange={(value) => updateField("travelTime", value)}
                error={fieldErrors.travelTime}
              />
            </div>
          </section>

          <section className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Yolcu ve yolculuk detayları
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Kapasite, uçuş ve konaklama notları.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <CounterField
                label="Yetişkin"
                value={form.adults}
                onChange={(value) => updateField("adults", value)}
                error={fieldErrors.adults}
                min={1}
              />
              <CounterField
                label="Çocuk"
                value={form.children}
                onChange={(value) => updateField("children", value)}
                error={fieldErrors.children}
              />
              <CounterField
                label="Bebek"
                value={form.babies}
                onChange={(value) => updateField("babies", value)}
                error={fieldErrors.babies}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Uçuş numarası"
                placeholder="TK1234"
                value={form.flightCode}
                onChange={(value) => updateField("flightCode", value)}
                error={fieldErrors.flightCode}
              />
              <TextField
                label="Otel adı veya adres"
                placeholder="Otel adı, açık adres veya açıklama"
                value={form.hotelNameOrAddress}
                onChange={(value) => updateField("hotelNameOrAddress", value)}
                error={fieldErrors.hotelNameOrAddress}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CheckboxCard
                label="Çocuk koltuğu"
                description="Rezervasyona çocuk koltuğu ekle."
                checked={form.childSeatRequested}
                onChange={(value) => updateField("childSeatRequested", value)}
                error={fieldErrors.childSeatRequested}
              />
              <CheckboxCard
                label="Ek bagaj"
                description="Ek bagaj ihtiyacı var."
                checked={form.extraBaggageRequested}
                onChange={(value) => updateField("extraBaggageRequested", value)}
                error={fieldErrors.extraBaggageRequested}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <CheckboxCard
                label="VIP karşılama"
                description="Havalimanında özel karşılama hizmeti ekle."
                checked={form.vipGreetingRequested}
                onChange={(value) => updateField("vipGreetingRequested", value)}
                error={fieldErrors.vipGreetingRequested}
              />
              <TextField
                label="Bekleme süresi (dk)"
                placeholder="0"
                type="number"
                value={form.waitingMinutes}
                onChange={(value) => updateField("waitingMinutes", value)}
                error={fieldErrors.waitingMinutes}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Havalimanı otopark ücreti"
                placeholder="0"
                type="number"
                value={form.airportParkingFee}
                onChange={(value) => updateField("airportParkingFee", value)}
                error={fieldErrors.airportParkingFee}
              />
              <TextField
                label="Kupon kodu"
                placeholder="WELCOME10"
                value={form.couponCode}
                onChange={(value) => updateField("couponCode", value)}
                error={fieldErrors.couponCode}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Araç tipi"
                required
                value={form.vehicleCategory}
                onChange={(value) => updateField("vehicleCategory", value)}
                error={fieldErrors.vehicleCategory}
                options={TRANSFER_VEHICLE_CATEGORY_OPTIONS.map((item) => ({
                  label: item.label,
                  value: item.value,
                }))}
              />
              <TextField
                label="Acenta adı"
                placeholder="Acenta veya B2B partner"
                value={form.agencyName}
                onChange={(value) => updateField("agencyName", value)}
                error={fieldErrors.agencyName}
              />
              <SelectField
                label="Para birimi"
                required
                value={form.currency}
                onChange={(value) => updateField("currency", value)}
                error={fieldErrors.currency}
                options={PRICING_CURRENCIES.map((currency) => ({
                  label: currency,
                  value: currency,
                }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Yüzdesel indirim"
                placeholder="0"
                type="number"
                value={form.discountPercent}
                onChange={(value) => updateField("discountPercent", value)}
                error={fieldErrors.discountPercent}
              />
              <TextField
                label="Sabit tutar indirimi"
                placeholder="0"
                type="number"
                value={form.discountAmount}
                onChange={(value) => updateField("discountAmount", value)}
                error={fieldErrors.discountAmount}
              />
            </div>

            <TextAreaField
              label="Özel not"
              placeholder="Karşılama notu, operasyon notu, ekstra detay..."
              rows={5}
              value={form.notes}
              onChange={(value) => updateField("notes", value)}
              error={fieldErrors.notes}
            />
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={saveState.status === "saving"}
            >
              {saveState.status === "saving" ? "Kaydediliyor..." : "Rezervasyonu kaydet"}
            </button>
            <Link
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              href="/app/reservations"
            >
              Listeye dön
            </Link>
          </div>
        </form>

        <aside className="grid gap-4 self-start">
          <article className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-1">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                Fiyat özeti
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Rezervasyon için canlı hesaplanan fiyat kırılımı.
              </p>
            </div>

            <div className="grid gap-3 rounded-[24px] bg-slate-50 p-4">
              <PreviewRow label="Rota" value={preview.route} />
              <PreviewRow
                label="Tarih / Saat"
                value={`${form.travelDate || "-"} ${form.travelTime || ""}`.trim()}
              />
              <PreviewRow label="Yolculuk tipi" value={preview.tripType} />
              <PreviewRow label="Yolcu" value={preview.passengers} />
              <PreviewRow label="Araç tipi" value={form.vehicleCategory || "-"} />
              <PreviewRow label="Para birimi" value={displayedQuote.currency} />
            </div>

            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-4">
              {pricingState.status === "loading" ? (
                <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
                  Fiyat hesaplanıyor...
                </div>
              ) : null}
              {pricingState.status === "error" && pricingState.message ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pricingState.message}
                </div>
              ) : null}
              <MoneyRow label="Ana ücret" value={formatMoneyValue(displayedQuote.basePrice, displayedQuote.currency)} />
              <MoneyRow label="Ek hizmetler" value={formatMoneyValue(displayedQuote.extras, displayedQuote.currency)} />
              <MoneyRow label="İndirim" value={`-${formatMoneyValue(displayedQuote.discount, displayedQuote.currency)}`} />
              <MoneyRow label="Vergi" value={formatMoneyValue(displayedQuote.tax, displayedQuote.currency)} />
              <MoneyRow label="Toplam" value={formatMoneyValue(displayedQuote.total, displayedQuote.currency)} emphasis />
            </div>

            <div className="grid gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Breakdown
              </div>
              {displayedQuote.breakdown.slice(0, 8).map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">{item.label}</span>
                  <span
                    className={`font-semibold ${
                      item.kind === "discount" ? "text-rose-600" : "text-slate-950"
                    }`}
                  >
                    {formatMoneyValue(item.amount, displayedQuote.currency)}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="grid gap-3 rounded-[28px] border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">
              Entegrasyon notu
            </div>
            <p className="text-sm leading-7 text-slate-200">
              Bu form, rezervasyon verisini şu an Supabase tablosuna kaydediyor. Sonraki adımda
              fiyat hesaplama, kampanya kuralları ve ödeme akışı aynı payload üzerinde
              genişletilebilir.
            </p>
          </article>
        </aside>
      </div>
    </section>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </div>
      <div className="max-w-[60%] text-right text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 last:border-b-0 last:pb-0">
      <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${emphasis ? "text-slate-950" : "text-slate-800"}`}>
        {value}
      </div>
    </div>
  );
}

function formatMoneyValue(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency ?? "TRY"}`;
}
