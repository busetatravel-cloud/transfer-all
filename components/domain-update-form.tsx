"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type Props = {
  businessId: string;
  domain: string | null;
  domainStatus: "pending" | "verified" | "active";
};

type FormState = {
  error: string | null;
  success: string | null;
};

export function DomainUpdateForm({ businessId, domain, domainStatus }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    error: null,
    success: null,
  });
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    setState({ error: null, success: null });

    const response = await fetch(`/api/super-admin/businesses/${businessId}/domain`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setState({
        error: body?.error ?? "Domain güncellenemedi.",
        success: null,
      });
      return;
    }

    setState({
      error: null,
      success: "Domain güncellendi.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="domain" label="Domain" defaultValue={domain ?? ""} placeholder="firma.com" />
        <label className="grid gap-2">
          <span className="text-sm font-medium text-slate-700">Domain status</span>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
            name="domainStatus"
            defaultValue={domainStatus}
          >
            <option value="pending">pending</option>
            <option value="verified">verified</option>
            <option value="active">active</option>
          </select>
        </label>
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.success}
        </p>
      ) : null}

      <p className="text-xs leading-6 text-slate-500">
        Platform domain kaydedilemez. Public site yalnızca active domain ile açılır.
      </p>

      <button
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Kaydediliyor..." : "Domain kaydet"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
      />
    </label>
  );
}
