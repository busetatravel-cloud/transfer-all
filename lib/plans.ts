import "server-only";

import { randomUUID } from "node:crypto";
import { updateBusinessSubscriptionRecord } from "@/lib/business";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";

export type SubscriptionPlanRecord = {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  features: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionPlanInput = {
  name: string;
  monthlyPrice: number | string;
  yearlyPrice: number | string;
  trialDays: number | string;
  features: string[] | string;
  active: boolean;
};

const demoPlans = new Map<string, SubscriptionPlanRecord>([
  [
    "plan-starter",
    {
      id: "plan-starter",
      name: "Starter",
      monthlyPrice: 49,
      yearlyPrice: 490,
      trialDays: 7,
      features: ["Rezervasyon yönetimi", "Temel bildirimler", "Standart destek"],
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  [
    "plan-pro",
    {
      id: "plan-pro",
      name: "Pro",
      monthlyPrice: 99,
      yearlyPrice: 990,
      trialDays: 14,
      features: ["Yayın merkezi", "Görevler", "Gelişmiş operasyon"],
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
  [
    "plan-enterprise",
    {
      id: "plan-enterprise",
      name: "Enterprise",
      monthlyPrice: 199,
      yearlyPrice: 1990,
      trialDays: 30,
      features: ["Özel domain", "Özel destek", "Çoklu ekip yönetimi"],
      active: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    },
  ],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  return String(value ?? "").trim();
}

function normalizeNumber(value: number | string | undefined, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeFeatures(value: string[] | string) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mapPlan(row: Record<string, unknown>): SubscriptionPlanRecord {
  const features = row.features;

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    monthlyPrice: Number(row.monthly_price ?? 0),
    yearlyPrice: Number(row.yearly_price ?? 0),
    trialDays: Number(row.trial_days ?? 0),
    features: Array.isArray(features)
      ? features.map((item) => String(item ?? "").trim()).filter(Boolean)
      : String(features ?? "")
          .split(/\r?\n|,/)
          .map((item) => item.trim())
          .filter(Boolean),
    active: Boolean(row.active ?? false),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response?.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

export async function listPlans() {
  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/subscription_plans?select=id,name,monthly_price,yearly_price,trial_days,features,active,created_at,updated_at&order=created_at.desc`,
    );

    return rows.map(mapPlan);
  }

  return Array.from(demoPlans.values());
}

export async function getPlanById(planId: string) {
  const safePlanId = planId.trim();

  if (!safePlanId) {
    return null;
  }

  if (hasSupabaseConnection()) {
    const rows = await readRows(
      `/subscription_plans?select=id,name,monthly_price,yearly_price,trial_days,features,active,created_at,updated_at&id=eq.${encodeURIComponent(
        safePlanId,
      )}&limit=1`,
    );

    return rows[0] ? mapPlan(rows[0]) : null;
  }

  return demoPlans.get(safePlanId) ?? null;
}

export async function createPlan(input: SubscriptionPlanInput) {
  const payload = {
    name: normalizeText(input.name),
    monthly_price: normalizeNumber(input.monthlyPrice),
    yearly_price: normalizeNumber(input.yearlyPrice),
    trial_days: Math.max(0, Math.trunc(normalizeNumber(input.trialDays))),
    features: normalizeFeatures(input.features),
    active: Boolean(input.active),
  };

  if (!payload.name) {
    throw new Error("Paket adı gerekli.");
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch("/subscription_plans", {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        ...payload,
      }),
    });

    if (!response?.ok) {
      const text = response ? await response.text().catch(() => "") : "";
      throw new Error(text || "Paket oluşturulamadı.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapPlan(rows[0]) : null;
  }

  const record: SubscriptionPlanRecord = {
    id: `plan-${randomUUID()}`,
    name: payload.name,
    monthlyPrice: payload.monthly_price,
    yearlyPrice: payload.yearly_price,
    trialDays: payload.trial_days,
    features: payload.features,
    active: payload.active,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  demoPlans.set(record.id, record);
  return record;
}

export async function updatePlan(
  planId: string,
  input: Partial<SubscriptionPlanInput>,
) {
  const safePlanId = planId.trim();

  if (!safePlanId) {
    throw new Error("Paket bulunamadı.");
  }

  const current = await getPlanById(safePlanId);

  if (!current) {
    throw new Error("Paket bulunamadı.");
  }

  const payload = {
    name: input.name === undefined ? current.name : normalizeText(input.name),
    monthly_price:
      input.monthlyPrice === undefined
        ? current.monthlyPrice
        : normalizeNumber(input.monthlyPrice),
    yearly_price:
      input.yearlyPrice === undefined
        ? current.yearlyPrice
        : normalizeNumber(input.yearlyPrice),
    trial_days:
      input.trialDays === undefined
        ? current.trialDays
        : Math.max(0, Math.trunc(normalizeNumber(input.trialDays))),
    features:
      input.features === undefined ? current.features : normalizeFeatures(input.features),
    active: input.active === undefined ? current.active : Boolean(input.active),
  };

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/subscription_plans?id=eq.${encodeURIComponent(safePlanId)}`,
      {
        method: "PATCH",
        headers: {
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          ...payload,
          updated_at: nowIso(),
        }),
      },
    );

    if (!response?.ok) {
      const text = response ? await response.text().catch(() => "") : "";
      throw new Error(text || "Paket güncellenemedi.");
    }

    const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
    return rows[0] ? mapPlan(rows[0]) : current;
  }

  const next: SubscriptionPlanRecord = {
    ...current,
    name: payload.name,
    monthlyPrice: payload.monthly_price,
    yearlyPrice: payload.yearly_price,
    trialDays: payload.trial_days,
    features: payload.features,
    active: payload.active,
    updatedAt: nowIso(),
  };

  demoPlans.set(next.id, next);
  return next;
}

export async function deletePlan(planId: string) {
  const safePlanId = planId.trim();

  if (!safePlanId) {
    throw new Error("Paket bulunamadı.");
  }

  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/subscription_plans?id=eq.${encodeURIComponent(safePlanId)}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      const text = response ? await response.text().catch(() => "") : "";
      throw new Error(text || "Paket silinemedi.");
    }

    return true;
  }

  demoPlans.delete(safePlanId);
  return true;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function assignPlanToBusiness(
  businessId: string,
  planId: string | null,
) {
  const safeBusinessId = businessId.trim();

  if (!safeBusinessId) {
    throw new Error("Business bulunamadı.");
  }

  if (!planId) {
    return updateBusinessSubscriptionRecord(safeBusinessId, {
      planId: null,
      packageName: null,
      packageStart: null,
      packageEnd: null,
    });
  }

  const plan = await getPlanById(planId);

  if (!plan) {
    throw new Error("Paket bulunamadı.");
  }

  const now = new Date();
  const packageStart = now.toISOString();
  const packageEnd = plan.trialDays > 0 ? addDays(now, plan.trialDays).toISOString() : null;

  return updateBusinessSubscriptionRecord(safeBusinessId, {
    planId: plan.id,
    packageName: plan.name,
    packageStart,
    packageEnd,
  });
}
