"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import type { PricingRuleRecord } from "@/lib/pricing-rule-types";
import {
  PRICING_CURRENCIES,
  TRANSFER_VEHICLE_CATEGORY_OPTIONS,
} from "@/lib/pricing-engine";
import {
  CheckboxCard,
  FormField,
  SelectField,
  TextAreaField,
  TextField,
} from "./transfer-reservation-engine/transfer-reservation-field";

type BusinessOption = {
  id: string;
  name: string;
};

type Props = {
  scope: "business" | "super-admin";
  businessId?: string;
  businessName?: string;
  businessOptions?: BusinessOption[];
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

type LoadState = {
  status: "idle" | "loading" | "ready" | "error";
  message: string;
};

type PricingRuleFormState = {
  name: string;
  active: boolean;
  priority: string;
  origin: string;
  destination: string;
  vehicleCategory: string;
  tripType: string;
  currency: string;
  seasonMonths: string;
  seasonMultiplier: string;
  basePrice: string;
  minimumPrice: string;
  dayMultiplier: string;
  nightMultiplier: string;
  nightFee: string;
  roundTripMultiplier: string;
  taxRate: string;
  childSeatFee: string;
  extraBaggageFee: string;
  vipGreetingFee: string;
  waitingFeePerMinute: string;
  airportParkingFee: string;
  discountPercent: string;
  discountAmount: string;
  couponCode: string;
  agencyName: string;
  couponDiscountPercent: string;
  couponDiscountAmount: string;
  agencyDiscountPercent: string;
  agencyDiscountAmount: string;
  notes: string;
};

function emptyForm(): PricingRuleFormState {
  return {
    name: "",
    active: true,
    priority: "100",
    origin: "",
    destination: "",
    vehicleCategory: "",
    tripType: "",
    currency: "TRY",
    seasonMonths: "",
    seasonMultiplier: "1",
    basePrice: "0",
    minimumPrice: "0",
    dayMultiplier: "1",
    nightMultiplier: "1",
    nightFee: "0",
    roundTripMultiplier: "1",
    taxRate: "0.2",
    childSeatFee: "0",
    extraBaggageFee: "0",
    vipGreetingFee: "0",
    waitingFeePerMinute: "0",
    airportParkingFee: "0",
    discountPercent: "0",
    discountAmount: "0",
    couponCode: "",
    agencyName: "",
    couponDiscountPercent: "0",
    couponDiscountAmount: "0",
    agencyDiscountPercent: "0",
    agencyDiscountAmount: "0",
    notes: "",
  };
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeJsonBody(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  return body as Record<string, unknown>;
}

function parseNumericString(value: string) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSeasonMonths(value: string) {
  return value
    .split(/[,\s]+/)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry >= 1 && entry <= 12)
    .map((entry) => Math.trunc(entry))
    .filter((entry, index, array) => array.indexOf(entry) === index)
    .sort((left, right) => left - right)
    .join(", ");
}

function ruleRouteLabel(rule: PricingRuleRecord) {
  const from = rule.origin || "Any";
  const to = rule.destination || "Any";
  return `${from} -> ${to}`;
}

function ruleVehicleLabel(rule: PricingRuleRecord) {
  return rule.vehicleCategory || "Any vehicle";
}

function readRulePayload(form: PricingRuleFormState, businessId: string) {
  return {
    businessId,
    name: form.name,
    active: form.active,
    priority: form.priority,
    origin: form.origin,
    destination: form.destination,
    vehicleCategory: form.vehicleCategory,
    tripType: form.tripType,
    currency: form.currency,
    seasonMonths: form.seasonMonths,
    seasonMultiplier: form.seasonMultiplier,
    basePrice: form.basePrice,
    minimumPrice: form.minimumPrice,
    dayMultiplier: form.dayMultiplier,
    nightMultiplier: form.nightMultiplier,
    nightFee: form.nightFee,
    roundTripMultiplier: form.roundTripMultiplier,
    taxRate: form.taxRate,
    childSeatFee: form.childSeatFee,
    extraBaggageFee: form.extraBaggageFee,
    vipGreetingFee: form.vipGreetingFee,
    waitingFeePerMinute: form.waitingFeePerMinute,
    airportParkingFee: form.airportParkingFee,
    discountPercent: form.discountPercent,
    discountAmount: form.discountAmount,
    couponCode: form.couponCode,
    agencyName: form.agencyName,
    couponDiscountPercent: form.couponDiscountPercent,
    couponDiscountAmount: form.couponDiscountAmount,
    agencyDiscountPercent: form.agencyDiscountPercent,
    agencyDiscountAmount: form.agencyDiscountAmount,
    notes: form.notes,
  };
}

function mapRuleToForm(rule: PricingRuleRecord): PricingRuleFormState {
  return {
    name: rule.name,
    active: rule.active,
    priority: String(rule.priority),
    origin: rule.origin ?? "",
    destination: rule.destination ?? "",
    vehicleCategory: rule.vehicleCategory ?? "",
    tripType: rule.tripType ?? "",
    currency: rule.currency,
    seasonMonths: rule.seasonMonths.join(", "),
    seasonMultiplier: String(rule.seasonMultiplier),
    basePrice: String(rule.basePrice),
    minimumPrice: String(rule.minimumPrice),
    dayMultiplier: String(rule.dayMultiplier),
    nightMultiplier: String(rule.nightMultiplier),
    nightFee: String(rule.nightFee),
    roundTripMultiplier: String(rule.roundTripMultiplier),
    taxRate: String(rule.taxRate),
    childSeatFee: String(rule.childSeatFee),
    extraBaggageFee: String(rule.extraBaggageFee),
    vipGreetingFee: String(rule.vipGreetingFee),
    waitingFeePerMinute: String(rule.waitingFeePerMinute),
    airportParkingFee: String(rule.airportParkingFee),
    discountPercent: String(rule.discountPercent),
    discountAmount: String(rule.discountAmount),
    couponCode: rule.couponCode ?? "",
    agencyName: rule.agencyName ?? "",
    couponDiscountPercent: String(rule.couponDiscountPercent),
    couponDiscountAmount: String(rule.couponDiscountAmount),
    agencyDiscountPercent: String(rule.agencyDiscountPercent),
    agencyDiscountAmount: String(rule.agencyDiscountAmount),
    notes: rule.notes ?? "",
  };
}

export function PricingRulesModule({
  scope,
  businessId,
  businessName,
  businessOptions = [],
}: Props) {
  const [selectedBusinessId, setSelectedBusinessId] = useState(businessId ?? "");
  const [rules, setRules] = useState<PricingRuleRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({
    status: "idle",
    message: "",
  });
  const [saveState, setSaveState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingRuleFormState>(emptyForm());
  const [filterText, setFilterText] = useState("");

  const endpointBase = scope === "super-admin"
    ? "/api/super-admin/pricing-rules"
    : "/api/business/pricing-rules";

  const effectiveBusinessId = scope === "super-admin" ? selectedBusinessId : businessId ?? "";

  const filteredRules = useMemo(() => {
    const query = filterText.trim().toLowerCase();

    return rules.filter((rule) => {
      if (!query) {
        return true;
      }

      return [
        rule.name,
        rule.origin,
        rule.destination,
        rule.vehicleCategory,
        rule.currency,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [filterText, rules]);

  useEffect(() => {
    if (scope === "super-admin" && !selectedBusinessId) {
      setRules([]);
      return;
    }

    const controller = new AbortController();

    async function loadRules() {
      try {
        setLoadState({ status: "loading", message: "Pricing rules yukleniyor..." });
        const url = new URL(endpointBase, window.location.origin);

        if (scope === "business") {
          url.searchParams.set("includeInactive", "1");
        } else if (selectedBusinessId) {
          url.searchParams.set("businessId", selectedBusinessId);
          url.searchParams.set("includeInactive", "1");
        }

        const response = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        const body = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            typeof body === "object" && body && "message" in body
              ? String((body as { message?: string }).message ?? "Pricing rules yuklenemedi.")
              : "Pricing rules yuklenemedi.",
          );
        }

        const pricingRules = (body as { pricingRules?: PricingRuleRecord[] } | null)?.pricingRules ?? [];
        setRules(pricingRules);
        setLoadState({ status: "ready", message: "" });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRules([]);
        setLoadState({
          status: "error",
          message: error instanceof Error ? error.message : "Pricing rules yuklenemedi.",
        });
      }
    }

    void loadRules();

    return () => controller.abort();
  }, [endpointBase, scope, selectedBusinessId]);

  useEffect(() => {
    if (!selectedRuleId) {
      setForm(emptyForm());
      return;
    }

    const rule = rules.find((item) => item.id === selectedRuleId);
    if (rule) {
      setForm(mapRuleToForm(rule));
    }
  }, [rules, selectedRuleId]);

  function updateField<K extends keyof PricingRuleFormState>(
    key: K,
    value: PricingRuleFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (scope === "super-admin" && !effectiveBusinessId) {
      setSaveState({
        status: "error",
        message: "Lutfen bir business secin.",
      });
      return;
    }

    setSaveState({ status: "saving", message: "Kaydediliyor..." });

    const payload = readRulePayload(form, effectiveBusinessId);
    const isEditing = Boolean(selectedRuleId);
    const url = isEditing ? `${endpointBase}/${selectedRuleId}` : endpointBase;

    try {
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          payload,
          businessId: effectiveBusinessId,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { message?: string; fieldErrors?: Record<string, string>; pricingRule?: PricingRuleRecord }
        | null;

      if (!response.ok) {
        setSaveState({
          status: "error",
          message: body?.message ?? "Pricing rule kaydedilemedi.",
        });
        return;
      }

      setSaveState({
        status: "saved",
        message: isEditing ? "Pricing rule guncellendi." : "Pricing rule olusturuldu.",
      });
      setSelectedRuleId(body?.pricingRule?.id ?? null);
      await reloadRules();
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Pricing rule kaydedilemedi.",
      });
    }
  }

  async function reloadRules() {
    if (scope === "super-admin" && !selectedBusinessId) {
      setRules([]);
      return;
    }

    const url = new URL(endpointBase, window.location.origin);

    if (scope === "business") {
      url.searchParams.set("includeInactive", "1");
    } else if (selectedBusinessId) {
      url.searchParams.set("businessId", selectedBusinessId);
      url.searchParams.set("includeInactive", "1");
    }

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });

    const body = (await response.json().catch(() => null)) as
      | { pricingRules?: PricingRuleRecord[]; message?: string }
      | null;

    if (response.ok) {
      setRules(body?.pricingRules ?? []);
      return;
    }

    setSaveState({
      status: "error",
      message: body?.message ?? "Pricing rules yenilenemedi.",
    });
  }

  async function handleDelete(rule: PricingRuleRecord) {
    const confirmed = window.confirm(`"${rule.name}" silinsin mi?`);
    if (!confirmed) {
      return;
    }

    if (scope === "super-admin" && !effectiveBusinessId) {
      setSaveState({
        status: "error",
        message: "Lutfen bir business secin.",
      });
      return;
    }

    setSaveState({ status: "saving", message: "Siliniyor..." });

    try {
      const response = await fetch(`${endpointBase}/${rule.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          businessId: rule.businessId,
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setSaveState({
          status: "error",
          message: body?.message ?? "Pricing rule silinemedi.",
        });
        return;
      }

      if (selectedRuleId === rule.id) {
        setSelectedRuleId(null);
        setForm(emptyForm());
      }

      setSaveState({
        status: "saved",
        message: "Pricing rule silindi.",
      });
      await reloadRules();
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Pricing rule silinemedi.",
      });
    }
  }

  function startCreate() {
    setSelectedRuleId(null);
    setForm(emptyForm());
  }

  function startEdit(rule: PricingRuleRecord) {
    setSelectedRuleId(rule.id);
    setForm(mapRuleToForm(rule));

    if (scope === "super-admin") {
      setSelectedBusinessId(rule.businessId);
    }
  }

  const businessTitle = scope === "super-admin" ? "Super Admin" : businessName ?? "Business";

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_56%,#eef2ff_100%)] p-6 shadow-sm lg:p-8">
        <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="grid gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Pricing Rules
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              Dinamik fiyat kurallari
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              {businessTitle} icin route, arac tipi, yol tipi, sezon, gece tarifesi ve minimum
              ucret kurallarini yonet. Bu ekran tenant izolasyonunu korur ve pricing engine ile
              ayni veri kaynagini kullanir.
            </p>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
            {scope === "super-admin" ? (
              <FormField label="Business secimi" required>
                <select
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  value={selectedBusinessId}
                  onChange={(event) => {
                    setSelectedBusinessId(event.target.value);
                    setSelectedRuleId(null);
                    setForm(emptyForm());
                  }}
                >
                  <option value="">Business secin</option>
                  {businessOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </FormField>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Business: <span className="font-semibold text-slate-950">{businessName}</span>
              </div>
            )}
            <div className="grid gap-2 text-sm text-slate-600">
              <div>{filteredRules.length} rule listeleniyor.</div>
              <div>Aktif/pasif ayrimi panelden yonetilir.</div>
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

      {loadState.status === "error" && loadState.message ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadState.message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <aside className="grid gap-4 self-start">
          <article className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                  Rule listesi
                </h2>
                <p className="text-sm leading-6 text-slate-600">
                  Aktif ve pasif tum kurallar.
                </p>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                type="button"
                onClick={startCreate}
              >
                Yeni rule
              </button>
            </div>

            <TextField
              label="Ara"
              placeholder="Rota, arac tipi, para birimi..."
              value={filterText}
              onChange={setFilterText}
            />

            <div className="grid gap-3">
              {loadState.status === "loading" ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Yukleniyor...
                </div>
              ) : null}

              {filteredRules.map((rule) => (
                <article
                  key={rule.id}
                  className={`grid gap-3 rounded-[24px] border p-4 transition ${
                    selectedRuleId === rule.id
                      ? "border-slate-900 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <h3 className="text-base font-semibold">{rule.name}</h3>
                      <p className={`text-sm ${selectedRuleId === rule.id ? "text-slate-200" : "text-slate-600"}`}>
                        {ruleRouteLabel(rule)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        rule.active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {rule.active ? "Aktif" : "Pasif"}
                    </span>
                  </div>

                  <div className="grid gap-1 text-sm">
                    <div>Arac: {ruleVehicleLabel(rule)}</div>
                    <div>Para birimi: {rule.currency}</div>
                    <div>Min ucret: {rule.minimumPrice}</div>
                    <div>Siralama: {rule.priority}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className={`inline-flex h-9 items-center justify-center rounded-2xl px-3 text-sm font-semibold transition ${
                        selectedRuleId === rule.id
                          ? "bg-white text-slate-950"
                          : "border border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                      }`}
                      type="button"
                      onClick={() => startEdit(rule)}
                    >
                      Duzenle
                    </button>
                    <button
                      className={`inline-flex h-9 items-center justify-center rounded-2xl px-3 text-sm font-semibold transition ${
                        selectedRuleId === rule.id
                          ? "bg-rose-200 text-rose-900"
                          : "border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
                      }`}
                      type="button"
                      onClick={() => void handleDelete(rule)}
                    >
                      Sil
                    </button>
                  </div>
                </article>
              ))}

              {filteredRules.length === 0 && loadState.status !== "loading" ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  Henuz pricing rule yok.
                </div>
              ) : null}
            </div>
          </article>
        </aside>

        <article className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">
                {selectedRuleId ? "Rule duzenle" : "Yeni rule"}
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Route, arac ve fiyat parametreleri.
              </p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              v2
            </div>
          </div>

          <form className="grid gap-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Rule adi"
                placeholder="Airport -> Hotel"
                required
                value={form.name}
                onChange={(value) => updateField("name", value)}
              />
              <TextField
                label="Oncelik"
                placeholder="100"
                type="number"
                value={form.priority}
                onChange={(value) => updateField("priority", value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Nereden"
                placeholder="Antalya Airport"
                value={form.origin}
                onChange={(value) => updateField("origin", value)}
              />
              <TextField
                label="Nereye"
                placeholder="City center"
                value={form.destination}
                onChange={(value) => updateField("destination", value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <SelectField
                label="Arac tipi"
                value={form.vehicleCategory}
                onChange={(value) => updateField("vehicleCategory", value)}
                options={[
                  { label: "Hepsi", value: "" },
                  ...TRANSFER_VEHICLE_CATEGORY_OPTIONS.map((item) => ({
                    label: item.label,
                    value: item.value,
                  })),
                ]}
              />
              <SelectField
                label="Yol tipi"
                value={form.tripType}
                onChange={(value) => updateField("tripType", value)}
                options={[
                  { label: "Hepsi", value: "" },
                  { label: "Tek yon", value: "one_way" },
                  { label: "Gidis / Donus", value: "round_trip" },
                ]}
              />
              <SelectField
                label="Para birimi"
                value={form.currency}
                onChange={(value) => updateField("currency", value)}
                options={PRICING_CURRENCIES.map((currency) => ({
                  label: currency,
                  value: currency,
                }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Sezon aylar"
                placeholder="6, 7, 8"
                value={form.seasonMonths}
                onChange={(value) => updateField("seasonMonths", parseSeasonMonths(value))}
              />
              <TextField
                label="Sezon carpan"
                placeholder="1.15"
                type="number"
                value={form.seasonMultiplier}
                onChange={(value) => updateField("seasonMultiplier", value)}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Ana fiyat" type="number" value={form.basePrice} onChange={(value) => updateField("basePrice", value)} />
              <TextField label="Minimum ucret" type="number" value={form.minimumPrice} onChange={(value) => updateField("minimumPrice", value)} />
              <TextField label="Vergi oranı" type="number" value={form.taxRate} onChange={(value) => updateField("taxRate", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Gunduz carpan" type="number" value={form.dayMultiplier} onChange={(value) => updateField("dayMultiplier", value)} />
              <TextField label="Gece carpan" type="number" value={form.nightMultiplier} onChange={(value) => updateField("nightMultiplier", value)} />
              <TextField label="Gece farki" type="number" value={form.nightFee} onChange={(value) => updateField("nightFee", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="Gidis / Donus carpan" type="number" value={form.roundTripMultiplier} onChange={(value) => updateField("roundTripMultiplier", value)} />
              <TextField label="Cocuk koltugu" type="number" value={form.childSeatFee} onChange={(value) => updateField("childSeatFee", value)} />
              <TextField label="Ek bagaj" type="number" value={form.extraBaggageFee} onChange={(value) => updateField("extraBaggageFee", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <TextField label="VIP karsilama" type="number" value={form.vipGreetingFee} onChange={(value) => updateField("vipGreetingFee", value)} />
              <TextField label="Bekleme / dk" type="number" value={form.waitingFeePerMinute} onChange={(value) => updateField("waitingFeePerMinute", value)} />
              <TextField label="Havalimani otopark" type="number" value={form.airportParkingFee} onChange={(value) => updateField("airportParkingFee", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Yuzdesel indirim" type="number" value={form.discountPercent} onChange={(value) => updateField("discountPercent", value)} />
              <TextField label="Sabit indirim" type="number" value={form.discountAmount} onChange={(value) => updateField("discountAmount", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Kupon kodu" value={form.couponCode} onChange={(value) => updateField("couponCode", value)} />
              <TextField label="Acente adi" value={form.agencyName} onChange={(value) => updateField("agencyName", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Kupon indirim %" type="number" value={form.couponDiscountPercent} onChange={(value) => updateField("couponDiscountPercent", value)} />
              <TextField label="Kupon indirim tutar" type="number" value={form.couponDiscountAmount} onChange={(value) => updateField("couponDiscountAmount", value)} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="Acente indirim %" type="number" value={form.agencyDiscountPercent} onChange={(value) => updateField("agencyDiscountPercent", value)} />
              <TextField label="Acente indirim tutar" type="number" value={form.agencyDiscountAmount} onChange={(value) => updateField("agencyDiscountAmount", value)} />
            </div>

            <TextAreaField
              label="Notlar"
              rows={4}
              value={form.notes}
              onChange={(value) => updateField("notes", value)}
              placeholder="Kurala ait operasyon notu..."
            />

            <CheckboxCard
              label="Aktif"
              description="Pasif kurallar hesaplamada kullanilmaz."
              checked={form.active}
              onChange={(value) => updateField("active", value)}
            />

            <div className="flex flex-wrap items-center gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={saveState.status === "saving" || loadState.status === "loading"}
                type="submit"
              >
                {saveState.status === "saving"
                  ? "Kaydediliyor..."
                  : selectedRuleId
                    ? "Guncelle"
                    : "Olustur"}
              </button>
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={startCreate}
              >
                Temizle
              </button>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                href={scope === "super-admin" ? "/super-admin" : "/app"}
              >
                Geri don
              </Link>
            </div>
          </form>
        </article>
      </div>
    </section>
  );
}
