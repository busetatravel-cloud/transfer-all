export const PAYMENT_PROVIDERS = [
  "manual",
  "iyzico",
  "stripe",
  "paytr",
  "square",
] as const;

export const PAYMENT_STATUSES = [
  "Pending",
  "Paid",
  "Partially Paid",
  "Failed",
  "Refunded",
  "Cancelled",
] as const;

export type PaymentProviderKey = (typeof PAYMENT_PROVIDERS)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: "Bekliyor",
  Paid: "Ödendi",
  "Partially Paid": "Kısmi ödeme",
  Failed: "Başarısız",
  Refunded: "İade edildi",
  Cancelled: "İptal edildi",
};

export type PaymentRecord = {
  id: string;
  businessId: string;
  reservationId: string;
  provider: PaymentProviderKey;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionReference: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PaymentReservationSeed = {
  id: string;
  businessId: string;
  totalAmount: number | null;
  currency: string | null;
};

export type PaymentUpsertInput = {
  businessId: string;
  reservationId: string;
  provider?: PaymentProviderKey;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionReference?: string | null;
};

export type PaymentUpdateInput = {
  businessId: string;
  paymentId: string;
  provider?: PaymentProviderKey;
  amount?: number;
  currency?: string;
  status?: PaymentStatus;
  transactionReference?: string | null;
};

export type PaymentProviderCreateInput = {
  businessId: string;
  reservationId: string;
  amount: number;
  currency: string;
  provider: PaymentProviderKey;
  reservationTotalAmount?: number | null;
};

export type PaymentProviderCompleteInput = {
  businessId: string;
  reservationId: string;
  paymentId: string;
  amount: number;
  currency: string;
  provider: PaymentProviderKey;
  reservationTotalAmount?: number | null;
  transactionReference?: string | null;
};

