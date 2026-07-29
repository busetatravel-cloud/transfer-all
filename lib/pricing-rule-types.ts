export const PRICING_CURRENCIES = ["TRY", "EUR", "USD", "GBP"] as const;

export type PricingCurrency = (typeof PRICING_CURRENCIES)[number];

export const TRANSFER_VEHICLE_CATEGORY_OPTIONS = [
  { label: "Standart", value: "standard" },
  { label: "Comfort", value: "comfort" },
  { label: "VIP", value: "vip" },
  { label: "Minivan", value: "minivan" },
  { label: "SUV", value: "suv" },
] as const;

export type TransferTripType = "one_way" | "round_trip";

export type PricingRuleRecord = {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
  priority: number;
  origin: string | null;
  destination: string | null;
  vehicleCategory: string | null;
  tripType: TransferTripType | null;
  currency: PricingCurrency;
  seasonMonths: number[];
  seasonMultiplier: number;
  basePrice: number;
  minimumPrice: number;
  dayMultiplier: number;
  nightMultiplier: number;
  nightFee: number;
  roundTripMultiplier: number;
  taxRate: number;
  childSeatFee: number;
  extraBaggageFee: number;
  vipGreetingFee: number;
  waitingFeePerMinute: number;
  airportParkingFee: number;
  discountPercent: number;
  discountAmount: number;
  couponCode: string | null;
  agencyName: string | null;
  couponDiscountPercent: number;
  couponDiscountAmount: number;
  agencyDiscountPercent: number;
  agencyDiscountAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PricingRuleSet = {
  pricingRules: PricingRuleRecord[];
};

export type PricingRuleUpsertInput = {
  businessId: string;
  name: string;
  active?: boolean;
  priority?: number | string;
  origin?: string;
  destination?: string;
  vehicleCategory?: string;
  tripType?: TransferTripType | "";
  currency?: PricingCurrency | string;
  seasonMonths?: number[] | string;
  seasonMultiplier?: number | string;
  basePrice?: number | string;
  minimumPrice?: number | string;
  dayMultiplier?: number | string;
  nightMultiplier?: number | string;
  nightFee?: number | string;
  roundTripMultiplier?: number | string;
  taxRate?: number | string;
  childSeatFee?: number | string;
  extraBaggageFee?: number | string;
  vipGreetingFee?: number | string;
  waitingFeePerMinute?: number | string;
  airportParkingFee?: number | string;
  discountPercent?: number | string;
  discountAmount?: number | string;
  couponCode?: string;
  agencyName?: string;
  couponDiscountPercent?: number | string;
  couponDiscountAmount?: number | string;
  agencyDiscountPercent?: number | string;
  agencyDiscountAmount?: number | string;
  notes?: string;
};

export type TransferPricingInput = {
  businessId: string;
  origin: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  tripType: TransferTripType;
  vehicleCategory: string;
  currency: PricingCurrency;
  adults: number;
  children: number;
  babies: number;
  childSeatRequested: boolean;
  extraBaggageRequested: boolean;
  vipGreetingRequested: boolean;
  waitingMinutes: number;
  airportParkingFee: number;
  agencyName: string;
  couponCode: string;
  discountPercent: number;
  discountAmount: number;
  ruleSet?: PricingRuleSet;
};

export type TransferPricingDraft = {
  businessId?: string;
  origin: string;
  destination: string;
  travelDate: string;
  travelTime: string;
  tripType: string;
  vehicleCategory: string;
  currency: string;
  adults: string | number;
  children: string | number;
  babies: string | number;
  childSeatRequested?: boolean;
  extraBaggageRequested?: boolean;
  vipGreetingRequested?: boolean;
  waitingMinutes?: string | number;
  airportParkingFee?: string | number;
  agencyName?: string;
  couponCode?: string;
  discountPercent?: string | number;
  discountAmount?: string | number;
  ruleSet?: PricingRuleSet;
};

export type PricingBreakdownItem = {
  key: string;
  label: string;
  amount: number;
  kind: "base" | "extra" | "discount" | "tax" | "info";
  meta?: Record<string, string | number | boolean | null>;
};

export type TransferPricingQuote = {
  basePrice: number;
  extras: number;
  discount: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: PricingCurrency;
  breakdown: PricingBreakdownItem[];
};
