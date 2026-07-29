import { randomUUID } from "node:crypto";
import {
  PAYMENT_PROVIDERS,
  type PaymentProviderCompleteInput,
  type PaymentProviderCreateInput,
  type PaymentProviderKey,
  type PaymentStatus,
} from "@/lib/payment-types";

export type PaymentProviderCreateResult = {
  provider: PaymentProviderKey;
  transactionReference: string;
  status: Extract<PaymentStatus, "Pending"> | Extract<PaymentStatus, "Partially Paid">;
  providerPayload: Record<string, unknown>;
};

export type PaymentProviderCompleteResult = {
  provider: PaymentProviderKey;
  transactionReference: string;
  status: Extract<PaymentStatus, "Paid" | "Partially Paid" | "Failed" | "Cancelled" | "Refunded">;
  providerPayload: Record<string, unknown>;
};

export type PaymentProviderAdapter = {
  createPayment(input: PaymentProviderCreateInput): Promise<PaymentProviderCreateResult>;
  completePayment(input: PaymentProviderCompleteInput): Promise<PaymentProviderCompleteResult>;
};

function buildTransactionReference(provider: PaymentProviderKey) {
  return `${provider.toUpperCase()}-${Date.now().toString(36)}-${randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase()}`;
}

function deriveCompletionStatus(amount: number, totalAmount?: number | null) {
  if (totalAmount !== undefined && totalAmount !== null) {
    if (totalAmount <= 0) {
      return "Paid" as const;
    }

    if (amount < totalAmount) {
      return "Partially Paid" as const;
    }

    return "Paid" as const;
  }

  if (amount <= 0) {
    return "Failed" as const;
  }

  return "Paid" as const;
}

function createStubProvider(provider: PaymentProviderKey): PaymentProviderAdapter {
  return {
    async createPayment(input) {
      const transactionReference = buildTransactionReference(provider);

      return {
        provider,
        transactionReference,
        status: "Pending",
        providerPayload: {
          businessId: input.businessId,
          reservationId: input.reservationId,
          amount: input.amount,
          currency: input.currency,
          reservationTotalAmount: input.reservationTotalAmount ?? null,
        },
      };
    },
    async completePayment(input) {
      const transactionReference = input.transactionReference ?? buildTransactionReference(provider);
      const status = deriveCompletionStatus(input.amount, input.reservationTotalAmount);

      return {
        provider,
        transactionReference,
        status,
        providerPayload: {
          businessId: input.businessId,
          reservationId: input.reservationId,
          paymentId: input.paymentId,
          amount: input.amount,
          currency: input.currency,
          reservationTotalAmount: input.reservationTotalAmount ?? null,
        },
      };
    },
  };
}

const providerRegistry = PAYMENT_PROVIDERS.reduce(
  (accumulator, provider) => {
    accumulator[provider] = createStubProvider(provider);
    return accumulator;
  },
  {} as Record<PaymentProviderKey, PaymentProviderAdapter>,
);

export function normalizePaymentProvider(value?: string | null) {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (PAYMENT_PROVIDERS.includes(normalized as PaymentProviderKey)) {
    return normalized as PaymentProviderKey;
  }

  return "manual" as const;
}

export function getPaymentProvider(provider?: string | null) {
  return providerRegistry[normalizePaymentProvider(provider)];
}
