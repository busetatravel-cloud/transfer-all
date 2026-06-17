"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type FormState = {
  error: string | null;
  success: string | null;
};

export function BusinessCreateForm() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    error: null,
    success: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setState({ error: null, success: null });
    setIsSubmitting(true);

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      const response = await fetch("/api/super-admin/businesses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;

        setState({
          error: body?.error ?? "Business olusturulamadi.",
          success: null,
        });
        return;
      }

      const body = (await response.json()) as {
        business?: { name?: string };
        admin?: { email?: string };
      };

      setState({
        error: null,
        success: `${
          body.business?.name ?? "Business"
        } olusturuldu. Primary admin: ${body.admin?.email ?? "-"}.`,
      });

      startTransition(() => {
        router.refresh();
        form.reset();
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-5" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Business create
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            Business ve primary admin olustur
          </h3>
        </div>
        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
          Stage 1
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Field name="name" label="Business adi" placeholder="Buse Transfer" />
        <Field name="email" label="Business email" placeholder="info@firma.com" />
        <Field name="phone" label="Telefon" placeholder="+90..." />
        <Field name="whatsapp" label="WhatsApp" placeholder="+90..." />
        <Field name="domain" label="Domain" placeholder="firma.com" />
        <Field name="adminEmail" label="Admin email" placeholder="admin@firma.com" />
      </div>

      <Field
        name="adminPassword"
        label="Admin sifresi"
        placeholder="Giris sifresi"
        type="password"
      />

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

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Admin login businessId ile baglanir. Business email ve user email ayridir.
        </p>
        <button
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isPending || isSubmitting}
          type="submit"
        >
          {isPending || isSubmitting ? "Kaydediliyor..." : "Olustur"}
        </button>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
        name={name}
        placeholder={placeholder}
        type={type}
        required
      />
    </label>
  );
}
