"use client";

import { useState, type FormEvent } from "react";
import type { PublicFormCopy } from "@/lib/public-copy";

type SaveState = {
  status: "idle" | "saving" | "saved" | "error";
  message: string;
};

export function PublicQuoteForm({
  businessId,
  previewBusinessId,
  copy,
}: {
  businessId: string;
  previewBusinessId?: string;
  copy: PublicFormCopy;
}) {
  const [state, setState] = useState<SaveState>({
    status: "idle",
    message: "",
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const body = Object.fromEntries(formData.entries());

    setState({ status: "saving", message: copy.sending });

    const response = await fetch("/api/public/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        businessId,
        previewBusinessId,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setState({
        status: "error",
        message: payload?.error ?? copy.error,
      });
      return;
    }

    setState({ status: "saved", message: copy.success });
    form.reset();
  }

  return (
    <form
      className="grid gap-3 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"
      onSubmit={submit}
    >
      <input type="hidden" name="businessId" value={businessId} />
      {previewBusinessId ? (
        <input type="hidden" name="previewBusinessId" value={previewBusinessId} />
      ) : null}
      <Status state={state} pending={state.status === "saving"} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="customerName" label={copy.customerName} />
        <Field name="phone" label={copy.phone} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="email" label={copy.email} type="email" />
        <div />
      </div>
      <Field name="message" label={copy.message} as="textarea" rows={5} />
      <button
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={state.status === "saving"}
        type="submit"
      >
        {copy.submit}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  type = "text",
  as = "input",
  rows = 4,
}: {
  name: string;
  label: string;
  type?: string;
  as?: "input" | "textarea";
  rows?: number;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {as === "textarea" ? (
        <textarea
          className="min-h-32 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          name={name}
          rows={rows}
        />
      ) : (
        <input
          className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
          name={name}
          type={type}
        />
      )}
    </label>
  );
}

function Status({ state, pending }: { state: SaveState; pending: boolean }) {
  const hidden = state.status === "idle" && !pending;
  if (hidden) return null;

  const tone =
    state.status === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : state.status === "saved"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${tone}`}>{state.message}</div>;
}

