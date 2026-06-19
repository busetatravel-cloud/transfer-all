"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BusinessListRecord } from "@/lib/business";
import type { SubscriptionPlanRecord } from "@/lib/plans";

type Props = {
  initialPlans: SubscriptionPlanRecord[];
  initialBusinesses: BusinessListRecord[];
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type PlanFormState = {
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  trialDays: string;
  features: string;
  active: boolean;
};

type AssignmentState = {
  businessId: string;
  planId: string;
};

function emptyPlanForm(): PlanFormState {
  return {
    name: "",
    monthlyPrice: "",
    yearlyPrice: "",
    trialDays: "",
    features: "",
    active: true,
  };
}

function normalizeFeatures(features: string[]) {
  return features.join("\n");
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function PlansModule({ initialPlans, initialBusinesses }: Props) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [form, setForm] = useState<PlanFormState>(emptyPlanForm());
  const [editId, setEditId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<AssignmentState>({
    businessId: initialBusinesses[0]?.id ?? "",
    planId: initialPlans[0]?.id ?? "",
  });
  const [state, setState] = useState<SaveState>({ status: "idle", message: "" });

  const activePlans = useMemo(() => plans.filter((plan) => plan.active), [plans]);

  async function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "saving", message: "Kaydediliyor..." });

    const payload = {
      name: form.name,
      monthlyPrice: form.monthlyPrice,
      yearlyPrice: form.yearlyPrice,
      trialDays: form.trialDays,
      features: form.features,
      active: form.active,
    };

    try {
      const response = await fetch(
        editId ? `/api/super-admin/plans/${editId}` : "/api/super-admin/plans",
        {
          method: editId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json().catch(() => null)) as
        | { message?: string; plan?: SubscriptionPlanRecord }
        | null;

      if (!response.ok) {
        throw new Error(body?.message || "Paket kaydedilemedi.");
      }

      const plan = body?.plan;

      if (plan) {
        setPlans((current) =>
          editId
            ? current.map((item) => (item.id === plan.id ? plan : item))
            : [plan, ...current],
        );
      }

      setForm(emptyPlanForm());
      setEditId(null);
      setState({
        status: "success",
        message: editId ? "Paket güncellendi." : "Paket oluşturuldu.",
      });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Paket kaydedilemedi.",
      });
    }
  }

  function startEdit(plan: SubscriptionPlanRecord) {
    setEditId(plan.id);
    setForm({
      name: plan.name,
      monthlyPrice: String(plan.monthlyPrice),
      yearlyPrice: String(plan.yearlyPrice),
      trialDays: String(plan.trialDays),
      features: normalizeFeatures(plan.features),
      active: plan.active,
    });
    setState({ status: "idle", message: "" });
  }

  async function removePlan(planId: string) {
    const confirmed = window.confirm("Bu paketi silmek istiyor musunuz?");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/super-admin/plans/${planId}`, {
      method: "DELETE",
      headers: { Accept: "application/json" },
    });

    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    if (!response.ok) {
      setState({
        status: "error",
        message: body?.message ?? "Paket silinemedi.",
      });
      return;
    }

    setPlans((current) => current.filter((item) => item.id !== planId));
    if (editId === planId) {
      setForm(emptyPlanForm());
      setEditId(null);
    }
    setState({ status: "success", message: "Paket silindi." });
    router.refresh();
  }

  async function assignPlan() {
    if (!assignment.businessId) {
      setState({ status: "error", message: "Business seçin." });
      return;
    }

    setState({ status: "saving", message: "Plan bağlanıyor..." });

    try {
      const response = await fetch(
        `/api/super-admin/businesses/${assignment.businessId}/plan`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ planId: assignment.planId || null }),
        },
      );

      const body = (await response.json().catch(() => null)) as
        | { message?: string; business?: BusinessListRecord }
        | null;

      if (!response.ok) {
        throw new Error(body?.message || "Plan bağlanamadı.");
      }

      if (body?.business) {
        setBusinesses((current) =>
          current.map((item) => (item.id === body.business?.id ? body.business! : item)),
        );
      }

      setState({ status: "success", message: "Plan business’a bağlandı." });
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Plan bağlanamadı.",
      });
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Paketler
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
          Paket / abonelik temel yönetimi
        </h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          Ödeme alma yok. Fatura yok. Sadece plan tanımları ve business’a bağlama altyapısı.
        </p>

        {state.message ? (
          <div
            className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
              state.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : state.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form className="mt-5 grid gap-4" onSubmit={submitPlan}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Paket adı"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
            />
            <Field
              label="Deneme süresi"
              type="number"
              value={form.trialDays}
              onChange={(value) => setForm((current) => ({ ...current, trialDays: value }))}
            />
            <Field
              label="Aylık fiyat"
              type="number"
              value={form.monthlyPrice}
              onChange={(value) => setForm((current) => ({ ...current, monthlyPrice: value }))}
            />
            <Field
              label="Yıllık fiyat"
              type="number"
              value={form.yearlyPrice}
              onChange={(value) => setForm((current) => ({ ...current, yearlyPrice: value }))}
            />
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Özellikler</span>
            <textarea
              className="min-h-36 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
              value={form.features}
              onChange={(event) =>
                setForm((current) => ({ ...current, features: event.target.value }))
              }
              placeholder={"Rezervasyon yönetimi\nGörevler\nYayın merkezi"}
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <input
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({ ...current, active: event.target.checked }))
              }
              type="checkbox"
            />
            Aktif
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="submit"
            >
              {editId ? "Güncelle" : "Paket oluştur"}
            </button>
            {editId ? (
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => {
                  setEditId(null);
                  setForm(emptyPlanForm());
                }}
              >
                İptal
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {plan.active ? "Aktif" : "Pasif"}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                    {plan.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Aylık {formatMoney(plan.monthlyPrice)} • Yıllık {formatMoney(plan.yearlyPrice)} • Deneme {plan.trialDays} gün
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                    type="button"
                    onClick={() => startEdit(plan)}
                  >
                    Düzenle
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-100"
                    type="button"
                    onClick={() => removePlan(plan.id)}
                  >
                    Sil
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.features.map((feature) => (
                  <span
                    key={feature}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </article>

      <article className="grid gap-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Bağlama
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
            Planı business’a bağla
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Seçilen plan, business kaydındaki paket bilgilerini günceller.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Business</span>
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400"
              value={assignment.businessId}
              onChange={(event) =>
                setAssignment((current) => ({ ...current, businessId: event.target.value }))
              }
            >
              {businesses.map((business) => (
                <option key={business.id} value={business.id}>
                  {business.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Plan</span>
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400"
              value={assignment.planId}
              onChange={(event) =>
                setAssignment((current) => ({ ...current, planId: event.target.value }))
              }
            >
              <option value="">Plan kaldır</option>
              {activePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
          type="button"
          onClick={assignPlan}
        >
          Planı uygula
        </button>

        <div className="grid gap-3">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">
            Business listesi
          </h3>
          <div className="grid gap-3">
            {businesses.map((business) => (
              <article
                key={business.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-950">
                      {business.name}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Paket: {business.packageName ?? "Yok"} • Bitiş: {formatDate(business.packageEnd)} • Durum: {getSubscriptionStatus(business)}
                    </div>
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {business.active ? "Aktif" : "Pasif"}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Yok";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
  }).format(date);
}

function getSubscriptionStatus(business: BusinessListRecord) {
  if (!business.packageName) {
    return "Plan yok";
  }

  if (!business.packageEnd) {
    return "Aktif";
  }

  const end = new Date(business.packageEnd);

  if (Number.isNaN(end.getTime())) {
    return "Aktif";
  }

  return end.getTime() >= Date.now() ? "Aktif" : "Süresi doldu";
}
