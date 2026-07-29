import {
  PRICING_CURRENCIES,
  TRANSFER_VEHICLE_CATEGORY_OPTIONS,
  type PricingBreakdownItem,
  type PricingCurrency,
  type PricingRuleRecord,
  type PricingRuleSet,
  type TransferPricingDraft,
  type TransferPricingInput,
  type TransferPricingQuote,
  type TransferTripType,
} from "@/lib/pricing-rule-types";

export { PRICING_CURRENCIES, TRANSFER_VEHICLE_CATEGORY_OPTIONS };
export type {
  PricingBreakdownItem,
  PricingCurrency,
  PricingRuleRecord,
  PricingRuleSet,
  TransferPricingDraft,
  TransferPricingInput,
  TransferPricingQuote,
  TransferTripType,
};

export class PricingRuleNotFoundError extends Error {
  code = "pricing_rule_not_found";

  constructor(message = "Pricing rule not found.") {
    super(message);
    this.name = "PricingRuleNotFoundError";
  }
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function normalizeCurrency(value: unknown): PricingCurrency {
  const normalized = normalizeText(value).toUpperCase();
  return PRICING_CURRENCIES.includes(normalized as PricingCurrency)
    ? (normalized as PricingCurrency)
    : "TRY";
}

function normalizeNumber(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseSeasonMonth(dateValue: string) {
  const date = new Date(`${normalizeText(dateValue)}T00:00:00`);
  const month = date.getMonth() + 1;
  return Number.isFinite(month) && month >= 1 && month <= 12 ? month : null;
}

function timeToMinutes(time: string) {
  const [hours, minutes] = normalizeText(time)
    .split(":")
    .map((part) => Number(part));

  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
}

function isNightTime(travelTime: string) {
  const minutes = timeToMinutes(travelTime);
  return minutes >= 22 * 60 || minutes < 6 * 60;
}

function matchText(source: string, target: string | null | undefined) {
  const normalizedSource = normalizeLower(source);
  const normalizedTarget = normalizeLower(target);

  if (!normalizedTarget) {
    return true;
  }

  if (!normalizedSource) {
    return false;
  }

  return (
    normalizedSource.includes(normalizedTarget) || normalizedTarget.includes(normalizedSource)
  );
}

function scoreRule(rule: PricingRuleRecord, input: TransferPricingInput, seasonMonth: number | null) {
  let score = 0;

  if (matchText(input.origin, rule.origin)) {
    score += rule.origin ? 3 : 0;
  } else if (rule.origin) {
    return -1;
  }

  if (matchText(input.destination, rule.destination)) {
    score += rule.destination ? 3 : 0;
  } else if (rule.destination) {
    return -1;
  }

  if (matchText(input.vehicleCategory, rule.vehicleCategory)) {
    score += rule.vehicleCategory ? 2 : 0;
  } else if (rule.vehicleCategory) {
    return -1;
  }

  if (rule.tripType && rule.tripType !== input.tripType) {
    return -1;
  }

  if (rule.tripType) {
    score += 2;
  }

  if (rule.currency !== input.currency) {
    return -1;
  }

  score += 2;

  if (rule.seasonMonths.length > 0) {
    if (seasonMonth === null || !rule.seasonMonths.includes(seasonMonth)) {
      return -1;
    }

    score += 2;
  }

  score += Math.min(5, Math.max(0, Math.trunc(rule.priority / 10)));

  return score;
}

function resolvePricingRule(
  input: TransferPricingInput,
  ruleSet?: PricingRuleSet,
): PricingRuleRecord {
  const pricingRules = ruleSet?.pricingRules ?? [];

  if (pricingRules.length === 0) {
    throw new PricingRuleNotFoundError("Pricing rules bulunamadi.");
  }

  const seasonMonth = parseSeasonMonth(input.travelDate);

  const matches = pricingRules
    .filter((rule) => rule.businessId === input.businessId && rule.active)
    .map((rule) => {
      const score = scoreRule(rule, input, seasonMonth);
      return score >= 0 ? { rule, score } : null;
    })
    .filter((entry): entry is { rule: PricingRuleRecord; score: number } => Boolean(entry))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.rule.priority !== left.rule.priority) {
        return right.rule.priority - left.rule.priority;
      }

      return right.rule.updatedAt.localeCompare(left.rule.updatedAt);
    });

  const match = matches[0]?.rule ?? null;

  if (!match) {
    throw new PricingRuleNotFoundError("Uygun pricing rule bulunamadi.");
  }

  return match;
}

function parseDraftToInput(draft: TransferPricingDraft): TransferPricingInput {
  return {
    businessId: normalizeText(draft.businessId),
    origin: normalizeText(draft.origin),
    destination: normalizeText(draft.destination),
    travelDate: normalizeText(draft.travelDate),
    travelTime: normalizeText(draft.travelTime),
    tripType: draft.tripType === "round_trip" ? "round_trip" : "one_way",
    vehicleCategory: normalizeText(draft.vehicleCategory) || "standard",
    currency: normalizeCurrency(draft.currency),
    adults: Math.max(0, Math.trunc(normalizeNumber(draft.adults, 1))),
    children: Math.max(0, Math.trunc(normalizeNumber(draft.children, 0))),
    babies: Math.max(0, Math.trunc(normalizeNumber(draft.babies, 0))),
    childSeatRequested: normalizeBoolean(draft.childSeatRequested),
    extraBaggageRequested: normalizeBoolean(draft.extraBaggageRequested),
    vipGreetingRequested: normalizeBoolean(draft.vipGreetingRequested),
    waitingMinutes: Math.max(0, Math.trunc(normalizeNumber(draft.waitingMinutes, 0))),
    airportParkingFee: Math.max(0, normalizeNumber(draft.airportParkingFee, 0)),
    agencyName: normalizeText(draft.agencyName),
    couponCode: normalizeText(draft.couponCode),
    discountPercent: Math.max(0, normalizeNumber(draft.discountPercent, 0)),
    discountAmount: Math.max(0, normalizeNumber(draft.discountAmount, 0)),
    ruleSet: draft.ruleSet,
  };
}

export function buildTransferPricingInputFromDraft(
  draft: TransferPricingDraft,
): TransferPricingInput {
  return parseDraftToInput(draft);
}

function pushBreakdown(
  breakdown: PricingBreakdownItem[],
  item: PricingBreakdownItem,
) {
  breakdown.push({
    ...item,
    amount: roundMoney(item.amount),
  });
}

export function calculateTransferPrice(input: TransferPricingInput) {
  const rule = resolvePricingRule(input, input.ruleSet);
  const isNight = isNightTime(input.travelTime);
  const seasonMonth = parseSeasonMonth(input.travelDate);
  const seasonApplied =
    rule.seasonMonths.length > 0 &&
    seasonMonth !== null &&
    rule.seasonMonths.includes(seasonMonth);

  let basePrice = roundMoney(rule.basePrice);
  const breakdown: PricingBreakdownItem[] = [];

  pushBreakdown(
    breakdown,
    {
      key: `rule:${rule.id}`,
      label: rule.name,
      amount: basePrice,
      kind: "base",
      meta: {
        route: `${input.origin} -> ${input.destination}`,
      },
    },
  );

  if (input.tripType === "round_trip" && rule.roundTripMultiplier !== 1) {
    const extra = roundMoney(basePrice * (rule.roundTripMultiplier - 1));
    pushBreakdown(
      breakdown,
      {
        key: "trip:round_trip",
        label: "Gidis / Donus",
        amount: extra,
        kind: "base",
      },
    );
    basePrice = roundMoney(basePrice * rule.roundTripMultiplier);
  }

  if (seasonApplied && rule.seasonMultiplier !== 1) {
    const extra = roundMoney(basePrice * (rule.seasonMultiplier - 1));
    pushBreakdown(
      breakdown,
      {
        key: `season:${rule.id}`,
        label: "Sezon farki",
        amount: extra,
        kind: "base",
      },
    );
    basePrice = roundMoney(basePrice * rule.seasonMultiplier);
  }

  if (isNight && rule.nightMultiplier !== 1) {
    const extra = roundMoney(basePrice * (rule.nightMultiplier - 1));
    pushBreakdown(
      breakdown,
      {
        key: `night:${rule.id}`,
        label: "Gece tarifesi",
        amount: extra,
        kind: "base",
      },
    );
    basePrice = roundMoney(basePrice * rule.nightMultiplier);
  }

  if (!isNight && rule.dayMultiplier !== 1) {
    const extra = roundMoney(basePrice * (rule.dayMultiplier - 1));
    pushBreakdown(
      breakdown,
      {
        key: `day:${rule.id}`,
        label: "Gunduz tarifesi",
        amount: extra,
        kind: "base",
      },
    );
    basePrice = roundMoney(basePrice * rule.dayMultiplier);
  }

  if (basePrice < rule.minimumPrice) {
    const extra = roundMoney(rule.minimumPrice - basePrice);
    pushBreakdown(
      breakdown,
      {
        key: `minimum:${rule.id}`,
        label: "Minimum ucret",
        amount: extra,
        kind: "base",
      },
    );
    basePrice = roundMoney(rule.minimumPrice);
  }

  let extras = 0;

  if (input.childSeatRequested && rule.childSeatFee > 0) {
    extras += rule.childSeatFee;
    pushBreakdown(
      breakdown,
      {
        key: `extra:child-seat:${rule.id}`,
        label: "Cocuk koltugu",
        amount: rule.childSeatFee,
        kind: "extra",
      },
    );
  }

  if (input.extraBaggageRequested && rule.extraBaggageFee > 0) {
    extras += rule.extraBaggageFee;
    pushBreakdown(
      breakdown,
      {
        key: `extra:extra-baggage:${rule.id}`,
        label: "Ek bagaj",
        amount: rule.extraBaggageFee,
        kind: "extra",
      },
    );
  }

  if (input.vipGreetingRequested && rule.vipGreetingFee > 0) {
    extras += rule.vipGreetingFee;
    pushBreakdown(
      breakdown,
      {
        key: `extra:vip-greeting:${rule.id}`,
        label: "VIP karsilama",
        amount: rule.vipGreetingFee,
        kind: "extra",
      },
    );
  }

  if (input.waitingMinutes > 0 && rule.waitingFeePerMinute > 0) {
    const charge = roundMoney(input.waitingMinutes * rule.waitingFeePerMinute);
    extras += charge;
    pushBreakdown(
      breakdown,
      {
        key: `extra:waiting:${rule.id}`,
        label: "Bekleme ucreti",
        amount: charge,
        kind: "extra",
        meta: { minutes: input.waitingMinutes },
      },
    );
  }

  if (rule.airportParkingFee > 0 || input.airportParkingFee > 0) {
    const charge = roundMoney(rule.airportParkingFee + input.airportParkingFee);
    if (charge > 0) {
      extras += charge;
      pushBreakdown(
        breakdown,
        {
          key: `extra:parking:${rule.id}`,
          label: "Havalimani otopark ucreti",
          amount: charge,
          kind: "extra",
        },
      );
    }
  }

  const subtotalBeforeDiscount = roundMoney(basePrice + extras);
  let discount = 0;

  if (rule.discountPercent > 0) {
    const amount = roundMoney(subtotalBeforeDiscount * (rule.discountPercent / 100));
    discount += amount;
    pushBreakdown(
      breakdown,
      {
        key: `discount:percent:${rule.id}`,
        label: "Yuzdesel indirim",
        amount,
        kind: "discount",
      },
    );
  }

  if (rule.discountAmount > 0) {
    const amount = roundMoney(rule.discountAmount);
    discount += amount;
    pushBreakdown(
      breakdown,
      {
        key: `discount:amount:${rule.id}`,
        label: "Sabit indirim",
        amount,
        kind: "discount",
      },
    );
  }

  if (
    rule.couponCode &&
    normalizeLower(rule.couponCode) === normalizeLower(input.couponCode)
  ) {
    const amount = rule.couponDiscountPercent > 0
      ? roundMoney(subtotalBeforeDiscount * (rule.couponDiscountPercent / 100))
      : roundMoney(rule.couponDiscountAmount);

    if (amount > 0) {
      discount += amount;
      pushBreakdown(
        breakdown,
        {
          key: `discount:coupon:${rule.id}`,
          label: "Kupon indirimi",
          amount,
          kind: "discount",
        },
      );
    }
  }

  if (
    rule.agencyName &&
    normalizeLower(input.agencyName).includes(normalizeLower(rule.agencyName))
  ) {
    const amount = rule.agencyDiscountPercent > 0
      ? roundMoney(subtotalBeforeDiscount * (rule.agencyDiscountPercent / 100))
      : roundMoney(rule.agencyDiscountAmount);

    if (amount > 0) {
      discount += amount;
      pushBreakdown(
        breakdown,
        {
          key: `discount:agency:${rule.id}`,
          label: "Acenteye ozel fiyat",
          amount,
          kind: "discount",
        },
      );
    }
  }

  if (input.discountPercent > 0) {
    const amount = roundMoney(subtotalBeforeDiscount * (input.discountPercent / 100));
    discount += amount;
    pushBreakdown(
      breakdown,
      {
        key: "discount:manual-percent",
        label: "Manuel yuzdesel indirim",
        amount,
        kind: "discount",
      },
    );
  }

  if (input.discountAmount > 0) {
    const amount = roundMoney(input.discountAmount);
    discount += amount;
    pushBreakdown(
      breakdown,
      {
        key: "discount:manual-amount",
        label: "Manuel sabit indirim",
        amount,
        kind: "discount",
      },
    );
  }

  discount = Math.min(discount, subtotalBeforeDiscount);

  const subtotal = roundMoney(Math.max(0, subtotalBeforeDiscount - discount));
  const tax = roundMoney(subtotal * rule.taxRate);
  const total = roundMoney(subtotal + tax);
  const currency = rule.currency;

  pushBreakdown(
    breakdown,
    {
      key: `tax:${rule.id}`,
      label: "Vergi",
      amount: tax,
      kind: "tax",
    },
  );

  return {
    basePrice: roundMoney(basePrice),
    extras: roundMoney(extras),
    discount: roundMoney(discount),
    subtotal,
    tax,
    total,
    currency,
    breakdown,
  };
}
