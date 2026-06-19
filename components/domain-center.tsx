"use client";

import { useRouter } from "next/navigation";
import {
  useMemo,
  useState,
  useTransition,
  type ButtonHTMLAttributes,
  type FormEvent,
} from "react";
import type { BusinessRecord } from "@/lib/business";
import {
  buildDomainAdapters,
  formatDomainStatusLabel,
  formatSslStatusLabel,
  type DomainProvider,
} from "@/lib/domain-utils";

type Props = {
  business: BusinessRecord;
};

type SubmitState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

const providerButtons: Array<{ value: DomainProvider; label: string }> = [
  { value: "vercel", label: "Vercel" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "custom", label: "Custom" },
];

async function readErrorBody(response: Response) {
  const rawText = await response.text().catch(() => "");

  if (!rawText.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawText) as
      | {
          error?: string;
          message?: string;
          code?: string;
          fieldErrors?: Record<string, string>;
          stack?: string;
        }
      | string;
  } catch {
    return rawText;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DomainCenter({ business }: Props) {
  const router = useRouter();
  const [hostname, setHostname] = useState(business.hostname ?? business.domain ?? "");
  const [provider, setProvider] = useState<DomainProvider>("custom");
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });
  const [isPending, startTransition] = useTransition();

  const normalizedHostname = hostname.trim() || business.hostname || business.domain || "";
  const adapters = useMemo(
    () =>
      buildDomainAdapters(
        normalizedHostname || "firma.com",
        business.verificationToken || "verification-token",
      ),
    [business.verificationToken, normalizedHostname],
  );
  const adapter = adapters.find((item) => item.provider === provider) ?? adapters[2];

  async function submit(
    action: "save" | "verify" | "remove",
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    setState({ status: "saving", message: "İşlem hazırlanıyor..." });

    const payload =
      action === "save"
        ? { action, hostname: hostname.trim() }
        : { action };

    console.info("DOMAIN ACTION PAYLOAD", payload);

    try {
      const response = await fetch("/api/business/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        const message =
          typeof body === "string"
            ? body
            : body?.message ?? body?.error ?? "Domain işlemi başarısız.";
        const code =
          typeof body === "string"
            ? ""
            : body?.code
              ? ` [${body.code}]`
              : "";
        const fieldErrors =
          typeof body === "object" && body && "fieldErrors" in body && body.fieldErrors
            ? `\n${JSON.stringify(body.fieldErrors, null, 2)}`
            : "";

        setState({
          status: "error",
          message: `${message}${code}${fieldErrors}`,
        });
        return;
      }

      setState({
        status: "success",
        message:
          action === "remove"
            ? "Domain kaldırıldı."
            : action === "verify"
              ? "Domain doğrulandı."
              : "Domain kaydedildi.",
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Domain işlemi başarısız.",
      });
    }
  }

  const currentDisplay = business.hostname ?? business.domain ?? "Henüz bağlı değil";
  const statusLabel = formatDomainStatusLabel(business.domainStatus);
  const sslLabel = formatSslStatusLabel(business.sslStatus);

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Domain Merkezi
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {currentDisplay}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Public site yalnızca aktif domain üzerinde açılır. Preview akışı etkilenmez.
              </p>
            </div>
            <div className="grid gap-2 text-right">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Durum: {statusLabel}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                SSL: {sslLabel}
              </span>
            </div>
          </div>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              void submit("save", event);
            }}
          >
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Hostname</span>
              <input
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                onChange={(event) => setHostname(event.target.value)}
                placeholder="firma.com"
                value={hostname}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <ActionButton disabled={isPending || !hostname.trim()} type="submit">
                Kaydet
              </ActionButton>
              <ActionButton
                disabled={isPending || !hostname.trim()}
                type="button"
                onClick={() => void submit("verify")}
              >
                Doğrula
              </ActionButton>
              <ActionButton
                disabled={isPending || currentDisplay === "Henüz bağlı değil"}
                tone="danger"
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(
                    "Domain kaldırılırsa public site kapanır ama preview korunur. Devam edilsin mi?",
                  );

                  if (!confirmed) {
                    return;
                  }

                  void submit("remove");
                }}
              >
                Kaldır
              </ActionButton>
            </div>

            {state.status !== "idle" ? (
              <p
                className={[
                  "rounded-2xl border px-4 py-3 text-sm",
                  state.status === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {state.message}
              </p>
            ) : null}

            <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
              <MetaItem label="Hostname" value={business.hostname ?? business.domain ?? "-"} />
              <MetaItem label="Verification token" value={business.verificationToken ?? "-"} />
              <MetaItem label="Verified at" value={formatDateTime(business.verifiedAt)} />
              <MetaItem label="Activated at" value={formatDateTime(business.activatedAt)} />
              <MetaItem label="Last check" value={formatDateTime(business.lastCheckedAt)} />
              <MetaItem label="SSL status" value={sslLabel} />
            </div>
          </form>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Bağlama Rehberi
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {providerButtons.find((item) => item.value === provider)?.label ?? "Custom"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Hazır DNS şablonları ve doğrulama tokeni aşağıda listelenir. Gerçek DNS sorgusu yapılmaz.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {providerButtons.map((item) => {
              const active = provider === item.value;
              return (
                <button
                  key={item.value}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-medium transition",
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  ].join(" ")}
                  type="button"
                  onClick={() => setProvider(item.value)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            {adapter.guide.map((step, index) => (
              <p key={step} className="text-sm leading-6 text-slate-700">
                <span className="mr-2 font-semibold text-slate-900">{index + 1}.</span>
                {step}
              </p>
            ))}
          </div>

          <div className="mt-5 grid gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              DNS Kayıtları
            </p>
            {adapter.records.map((record) => (
              <div
                key={`${record.type}-${record.host}-${record.value}`}
                className="rounded-[20px] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{record.type}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {record.host}
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    {record.note}
                  </span>
                </div>
                <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-700">
                  {record.value}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  tone = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "default" | "danger";
}) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger"
          ? "border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
          : "bg-slate-950 text-white hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
