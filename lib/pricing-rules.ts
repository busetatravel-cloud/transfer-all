import "server-only";

import { randomUUID } from "node:crypto";
import {
  PRICING_CURRENCIES,
  type PricingCurrency,
  type PricingRuleRecord,
  type PricingRuleSet,
  type PricingRuleUpsertInput,
  type TransferTripType,
} from "@/lib/pricing-rule-types";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

type PricingRuleDbRow = Record<string, unknown>;

export type PricingRuleListOptions = {
  includeInactive?: boolean;
};

export type PricingRuleQuery = {
  businessId?: string;
  includeInactive?: boolean;
};

export class PricingRuleValidationError extends Error {
  code = "validation_error";

  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string>) {
    super(message);
    this.name = "PricingRuleValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class PricingRuleNotFoundError extends Error {
  code = "pricing_rule_not_found";

  constructor(message = "Pricing rule not found.") {
    super(message);
    this.name = "PricingRuleNotFoundError";
  }
}

const demoPricingRules = new Map<string, PricingRuleRecord[]>();

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeOptionalText(value: unknown) {
  const safe = normalizeText(value);
  return safe || null;
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (value === true || value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === false || value === 0 || value === "0" || value === "false") {
    return false;
  }

  return fallback;
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCurrency(value: unknown): PricingCurrency {
  const normalized = normalizeText(value).toUpperCase();
  return PRICING_CURRENCIES.includes(normalized as PricingCurrency)
    ? (normalized as PricingCurrency)
    : "TRY";
}

function normalizeTripType(value: unknown): TransferTripType | null {
  const normalized = normalizeText(value);
  if (normalized === "one_way" || normalized === "round_trip") {
    return normalized;
  }
  return null;
}

function normalizeSeasonMonths(value: unknown): number[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => normalizeNumber(entry, NaN))
          .filter((entry) => Number.isFinite(entry))
          .map((entry) => Math.min(12, Math.max(1, Math.trunc(entry)))),
      ),
    ).sort((left, right) => left - right);
  }

  const raw = normalizeText(value);
  if (!raw) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(/[,\s]+/)
        .map((entry) => normalizeNumber(entry, NaN))
        .filter((entry) => Number.isFinite(entry))
        .map((entry) => Math.min(12, Math.max(1, Math.trunc(entry)))),
    ),
  ).sort((left, right) => left - right);
}

function normalizePricingRuleRecord(row: PricingRuleDbRow): PricingRuleRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    name: String(row.name ?? ""),
    active: Boolean(row.active ?? false),
    priority: Math.trunc(normalizeNumber(row.priority, 100)),
    origin: normalizeOptionalText(row.origin),
    destination: normalizeOptionalText(row.destination),
    vehicleCategory: normalizeOptionalText(row.vehicle_category),
    tripType: normalizeTripType(row.trip_type),
    currency: normalizeCurrency(row.currency),
    seasonMonths: normalizeSeasonMonths(row.season_months),
    seasonMultiplier: normalizeNumber(row.season_multiplier, 1),
    basePrice: normalizeNumber(row.base_price, 0),
    minimumPrice: normalizeNumber(row.minimum_price, 0),
    dayMultiplier: normalizeNumber(row.day_multiplier, 1),
    nightMultiplier: normalizeNumber(row.night_multiplier, 1),
    nightFee: normalizeNumber(row.night_fee, 0),
    roundTripMultiplier: normalizeNumber(row.round_trip_multiplier, 1),
    taxRate: normalizeNumber(row.tax_rate, 0.2),
    childSeatFee: normalizeNumber(row.child_seat_fee, 0),
    extraBaggageFee: normalizeNumber(row.extra_baggage_fee, 0),
    vipGreetingFee: normalizeNumber(row.vip_greeting_fee, 0),
    waitingFeePerMinute: normalizeNumber(row.waiting_fee_per_minute, 0),
    airportParkingFee: normalizeNumber(row.airport_parking_fee, 0),
    discountPercent: normalizeNumber(row.discount_percent, 0),
    discountAmount: normalizeNumber(row.discount_amount, 0),
    couponCode: normalizeOptionalText(row.coupon_code),
    agencyName: normalizeOptionalText(row.agency_name),
    couponDiscountPercent: normalizeNumber(row.coupon_discount_percent, 0),
    couponDiscountAmount: normalizeNumber(row.coupon_discount_amount, 0),
    agencyDiscountPercent: normalizeNumber(row.agency_discount_percent, 0),
    agencyDiscountAmount: normalizeNumber(row.agency_discount_amount, 0),
    notes: normalizeOptionalText(row.notes),
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: String(row.updated_at ?? nowIso()),
  };
}

function parsePricingRuleList(rows: PricingRuleDbRow[]) {
  return rows.map((row) => normalizePricingRuleRecord(row));
}

function buildPricingRulePayload(input: PricingRuleUpsertInput) {
  const fieldErrors: Record<string, string> = {};
  const name = normalizeText(input.name);
  const businessId = normalizeText(input.businessId);

  if (!businessId) {
    fieldErrors.businessId = "Business gerekli.";
  }

  if (!name) {
    fieldErrors.name = "Kural adi gerekli.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new PricingRuleValidationError("Lutfen zorunlu alanlari doldurun.", fieldErrors);
  }

  return {
    business_id: businessId,
    name,
    active: normalizeBoolean(input.active, true),
    priority: Math.trunc(normalizeNumber(input.priority, 100)),
    origin: normalizeOptionalText(input.origin),
    destination: normalizeOptionalText(input.destination),
    vehicle_category: normalizeOptionalText(input.vehicleCategory),
    trip_type: normalizeTripType(input.tripType),
    currency: normalizeCurrency(input.currency),
    season_months: normalizeSeasonMonths(input.seasonMonths),
    season_multiplier: normalizeNumber(input.seasonMultiplier, 1),
    base_price: normalizeNumber(input.basePrice, 0),
    minimum_price: normalizeNumber(input.minimumPrice, 0),
    day_multiplier: normalizeNumber(input.dayMultiplier, 1),
    night_multiplier: normalizeNumber(input.nightMultiplier, 1),
    night_fee: normalizeNumber(input.nightFee, 0),
    round_trip_multiplier: normalizeNumber(input.roundTripMultiplier, 1),
    tax_rate: normalizeNumber(input.taxRate, 0.2),
    child_seat_fee: normalizeNumber(input.childSeatFee, 0),
    extra_baggage_fee: normalizeNumber(input.extraBaggageFee, 0),
    vip_greeting_fee: normalizeNumber(input.vipGreetingFee, 0),
    waiting_fee_per_minute: normalizeNumber(input.waitingFeePerMinute, 0),
    airport_parking_fee: normalizeNumber(input.airportParkingFee, 0),
    discount_percent: normalizeNumber(input.discountPercent, 0),
    discount_amount: normalizeNumber(input.discountAmount, 0),
    coupon_code: normalizeOptionalText(input.couponCode),
    agency_name: normalizeOptionalText(input.agencyName),
    coupon_discount_percent: normalizeNumber(input.couponDiscountPercent, 0),
    coupon_discount_amount: normalizeNumber(input.couponDiscountAmount, 0),
    agency_discount_percent: normalizeNumber(input.agencyDiscountPercent, 0),
    agency_discount_amount: normalizeNumber(input.agencyDiscountAmount, 0),
    notes: normalizeOptionalText(input.notes),
  };
}

function ensureDemoRules(businessId: string) {
  if (!demoPricingRules.has(businessId)) {
    demoPricingRules.set(businessId, []);
  }

  return demoPricingRules.get(businessId) ?? [];
}

async function fetchPricingRuleRows(query: string) {
  const config = getSupabaseConfig();

  if (!config) {
    return [];
  }

  const response = await fetch(`${config.url}/rest/v1/pricing_rules${query}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    throw new Error(rawText || "Pricing rules okunamadi.");
  }

  return (await response.json().catch(() => [])) as PricingRuleDbRow[];
}

function buildBaseQuery(select = "*") {
  return `?select=${encodeURIComponent(select)}&order=priority.asc,updated_at.desc,created_at.desc`;
}

export async function listPricingRules(
  query: PricingRuleQuery = {},
): Promise<PricingRuleRecord[]> {
  if (!hasSupabaseConnection()) {
    const demoRows = query.businessId
      ? ensureDemoRules(query.businessId)
      : Array.from(demoPricingRules.values()).flat();

    return demoRows.filter((rule) => (query.includeInactive ? true : rule.active));
  }

  const filters: string[] = [];

  if (query.businessId) {
    filters.push(`business_id=eq.${encodeURIComponent(query.businessId)}`);
  }

  if (!query.includeInactive) {
    filters.push("active=eq.true");
  }

  const filterString = filters.length ? `&${filters.join("&")}` : "";
  const rows = await fetchPricingRuleRows(`${buildBaseQuery()}${filterString}`);
  return parsePricingRuleList(rows);
}

export async function getPricingRuleById(
  businessId: string,
  id: string,
): Promise<PricingRuleRecord | null> {
  if (!hasSupabaseConnection()) {
    return (
      ensureDemoRules(businessId).find((rule) => rule.id === id) ?? null
    );
  }

  const rows = await fetchPricingRuleRows(
    `?select=*&id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(
      businessId,
    )}&limit=1`,
  );

  return parsePricingRuleList(rows)[0] ?? null;
}

export async function createPricingRule(input: PricingRuleUpsertInput) {
  const payload = buildPricingRulePayload(input);

  if (!hasSupabaseConnection()) {
    const record: PricingRuleRecord = {
      id: randomUUID(),
      businessId: payload.business_id,
      name: payload.name,
      active: payload.active,
      priority: payload.priority,
      origin: payload.origin,
      destination: payload.destination,
      vehicleCategory: payload.vehicle_category,
      tripType: payload.trip_type,
      currency: payload.currency,
      seasonMonths: payload.season_months,
      seasonMultiplier: payload.season_multiplier,
      basePrice: payload.base_price,
      minimumPrice: payload.minimum_price,
      dayMultiplier: payload.day_multiplier,
      nightMultiplier: payload.night_multiplier,
      nightFee: payload.night_fee,
      roundTripMultiplier: payload.round_trip_multiplier,
      taxRate: payload.tax_rate,
      childSeatFee: payload.child_seat_fee,
      extraBaggageFee: payload.extra_baggage_fee,
      vipGreetingFee: payload.vip_greeting_fee,
      waitingFeePerMinute: payload.waiting_fee_per_minute,
      airportParkingFee: payload.airport_parking_fee,
      discountPercent: payload.discount_percent,
      discountAmount: payload.discount_amount,
      couponCode: payload.coupon_code,
      agencyName: payload.agency_name,
      couponDiscountPercent: payload.coupon_discount_percent,
      couponDiscountAmount: payload.coupon_discount_amount,
      agencyDiscountPercent: payload.agency_discount_percent,
      agencyDiscountAmount: payload.agency_discount_amount,
      notes: payload.notes,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const current = ensureDemoRules(payload.business_id);
    demoPricingRules.set(payload.business_id, [record, ...current]);
    return record;
  }

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase baglantisi bulunamadi.");
  }

  const response = await fetch(`${config.url}/rest/v1/pricing_rules`, {
    method: "POST",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    throw new Error(rawText || "Pricing rule olusturulamadi.");
  }

  const rows = (await response.json().catch(() => [])) as PricingRuleDbRow[];
  const record = parsePricingRuleList(rows)[0];

  if (!record) {
    throw new Error("Pricing rule olusturulamadi.");
  }

  return record;
}

export async function updatePricingRule(
  businessId: string,
  id: string,
  input: PricingRuleUpsertInput,
) {
  const payload = buildPricingRulePayload({ ...input, businessId });

  if (!hasSupabaseConnection()) {
    const current = ensureDemoRules(businessId);
    const index = current.findIndex((rule) => rule.id === id);

    if (index < 0) {
      throw new PricingRuleNotFoundError();
    }

    const updated: PricingRuleRecord = {
      ...current[index],
      id,
      businessId,
      name: payload.name,
      active: payload.active,
      priority: payload.priority,
      origin: payload.origin,
      destination: payload.destination,
      vehicleCategory: payload.vehicle_category,
      tripType: payload.trip_type,
      currency: payload.currency,
      seasonMonths: payload.season_months,
      seasonMultiplier: payload.season_multiplier,
      basePrice: payload.base_price,
      minimumPrice: payload.minimum_price,
      dayMultiplier: payload.day_multiplier,
      nightMultiplier: payload.night_multiplier,
      nightFee: payload.night_fee,
      roundTripMultiplier: payload.round_trip_multiplier,
      taxRate: payload.tax_rate,
      childSeatFee: payload.child_seat_fee,
      extraBaggageFee: payload.extra_baggage_fee,
      vipGreetingFee: payload.vip_greeting_fee,
      waitingFeePerMinute: payload.waiting_fee_per_minute,
      airportParkingFee: payload.airport_parking_fee,
      discountPercent: payload.discount_percent,
      discountAmount: payload.discount_amount,
      couponCode: payload.coupon_code,
      agencyName: payload.agency_name,
      couponDiscountPercent: payload.coupon_discount_percent,
      couponDiscountAmount: payload.coupon_discount_amount,
      agencyDiscountPercent: payload.agency_discount_percent,
      agencyDiscountAmount: payload.agency_discount_amount,
      notes: payload.notes,
      updatedAt: nowIso(),
    };

    current[index] = updated;
    demoPricingRules.set(businessId, current);
    return updated;
  }

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase baglantisi bulunamadi.");
  }

  const response = await fetch(
    `${config.url}/rest/v1/pricing_rules?id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(
      businessId,
    )}`,
    {
      method: "PATCH",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    throw new Error(rawText || "Pricing rule guncellenemedi.");
  }

  const rows = (await response.json().catch(() => [])) as PricingRuleDbRow[];
  const record = parsePricingRuleList(rows)[0];

  if (!record) {
    throw new PricingRuleNotFoundError();
  }

  return record;
}

export async function deletePricingRule(businessId: string, id: string) {
  if (!hasSupabaseConnection()) {
    const current = ensureDemoRules(businessId);
    const next = current.filter((rule) => rule.id !== id);
    demoPricingRules.set(businessId, next);
    return true;
  }

  const config = getSupabaseConfig();
  if (!config) {
    throw new Error("Supabase baglantisi bulunamadi.");
  }

  const response = await fetch(
    `${config.url}/rest/v1/pricing_rules?id=eq.${encodeURIComponent(id)}&business_id=eq.${encodeURIComponent(
      businessId,
    )}`,
    {
      method: "DELETE",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    throw new Error(rawText || "Pricing rule silinemedi.");
  }

  return true;
}

export async function loadBusinessPricingRuleSet(
  businessId: string,
  options: PricingRuleListOptions = {},
): Promise<PricingRuleSet> {
  const pricingRules = await listPricingRules({
    businessId,
    includeInactive: options.includeInactive,
  });

  return { pricingRules };
}
