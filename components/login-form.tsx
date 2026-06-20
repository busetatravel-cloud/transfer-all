"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

type LoginState = {
  code: string | null;
  error: string | null;
};

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [state, setState] = useState<LoginState>({ code: null, error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ code: null, error: null });
    setIsSubmitting(true);

    try {
      let response: Response;

      try {
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });
      } catch {
        setState({
          code: null,
          error: "Sunucuya baglanilamadi. Lutfen tekrar deneyin.",
        });
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { authMessage?: string; error?: string; code?: string }
          | null;

        setState({
          code: payload?.code ?? null,
          error: payload?.authMessage ?? payload?.error ?? "Giris yapilamadi.",
        });
        return;
      }

      const payload = (await response.json()) as {
        ok?: boolean;
        userId?: string | null;
        role?: "SUPER_ADMIN" | "BUSINESS_ADMIN";
        businessId?: string | null;
        error?: string;
      };

      if (!payload.ok || !payload.role) {
        setState({
          code: null,
          error: payload.error ?? "Giris yapilamadi.",
        });
        return;
      }

      startTransition(() => {
        if (payload.role === "SUPER_ADMIN") {
          router.push("/super-admin");
        } else if (payload.role === "BUSINESS_ADMIN") {
          router.push("/app");
        } else {
          setState({
            code: null,
            error: "Giris yapildi ama yonlendirme bulunamadi.",
          });
          return;
        }
        router.refresh();
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      {state.error ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.code ? `${state.code}: ` : ""}
          {state.error}
        </p>
      ) : null}

      <button
        className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending || isSubmitting}
        type="submit"
      >
        {isPending || isSubmitting ? "Giris yapiliyor..." : "Giris yap"}
      </button>
    </form>
  );
}
