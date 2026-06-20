"use client";

import { useMemo, useState, useTransition } from "react";
import type { ButtonHTMLAttributes, FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BusinessRecord } from "@/lib/business";
import {
  buildDomainAdapters,
  getBusinessPublicTarget,
  formatDomainStatusLabel,
  formatSslStatusLabel,
  getDomainStepIndex,
  getDnsCnameTarget,
  DOMAIN_PROVIDER_OPTIONS,
  type DomainProvider,
} from "@/lib/domain-utils";

type Props = {
  business: BusinessRecord;
};

type SubmitState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

const STEPS = ["Domain", "DNS", "Verify", "SSL", "Active"] as const;

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
          rawText?: string;
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

async function copyToClipboard(value: string) {
  if (!value.trim()) {
    return;
  }

  await navigator.clipboard.writeText(value);
}

export function DomainCenter({ business }: Props) {
  const router = useRouter();
  const [hostname, setHostname] = useState(business.hostname ?? business.domain ?? "");
  const [provider, setProvider] = useState<DomainProvider>("vercel");
  const [state, setState] = useState<SubmitState>({
    status: "idle",
    message: "",
  });
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const currentHostname = hostname.trim() || business.hostname || business.domain || "";
  const adapters = useMemo(
    () =>
      buildDomainAdapters(
        currentHostname || "firma.com",
        business.verificationToken || "verification-token",
        { cnameTarget: getDnsCnameTarget() },
      ),
    [business.verificationToken, currentHostname],
  );
  const adapter = adapters.find((item) => item.provider === provider) ?? adapters[0];
  const stepIndex = getDomainStepIndex(business.domainStatus);
  const isOpenable =
    Boolean(currentHostname.trim()) &&
    business.domainStatus === "active" &&
    (business.sslStatus === "ready" || business.sslStatus === "active");
  const activeLink = getBusinessPublicTarget(currentHostname) ?? null;

  async function submit(
    action: "save" | "check_dns" | "check_ssl" | "remove",
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    setState({ status: "saving", message: "İşlem hazırlanıyor..." });

    const payload =
      action === "save"
        ? { action, hostname: hostname.trim() }
        : { action };

    console.info("business.domain.action", {
      businessId: business.id,
      action,
      hostname: hostname.trim(),
    });

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
        const rawText =
          typeof body === "object" && body && "rawText" in body && body.rawText
            ? `\n${body.rawText}`
            : "";

        setState({
          status: "error",
          message: `${message}${code}${rawText}`,
        });
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { message?: string; statusLabel?: string }
        | null;

      setState({
        status: "success",
        message:
          body?.message ??
          (action === "remove"
            ? "Domain kaldırıldı."
            : action === "check_ssl"
              ? "SSL kontrolü tamamlandı."
              : "Domain güncellendi."),
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
      <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Domain Merkezi
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Onboarding akışı
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-slate-600">
              Domain, DNS, doğrulama ve SSL adımlarını tek akışta yönetin. Public site yalnızca
              aktif domainde açılır.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <StatusBadge label="Durum" value={statusLabel} />
            <StatusBadge label="SSL" value={sslLabel} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-5">
          {STEPS.map((step, index) => {
            const completed =
              business.domainStatus === "active"
                ? true
                : business.domainStatus === "failed"
                  ? false
                  : index <= stepIndex;
            const active = index === Math.max(stepIndex, 0) && business.domainStatus !== "active";

            return (
              <div
                key={step}
                className={[
                  "rounded-2xl border px-4 py-3 text-sm",
                  completed
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-500",
                ].join(" ")}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">
                  Adım {index + 1}
                </div>
                <div className="mt-1 font-semibold">{step}</div>
              </div>
            );
          })}
        </div>
      </article>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Domain
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {currentDisplay}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Domain kaydedin, DNS kayıtlarını kontrol edin, TXT doğrulamayı tamamlayın ve SSL
                hazır hale geldiğinde aktif edin.
              </p>
            </div>

            <div className="grid gap-2 text-right">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Güncel: {formatDomainStatusLabel(business.domainStatus)}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                SSL: {formatSslStatusLabel(business.sslStatus)}
              </span>
            </div>
          </div>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              void submit("save", event);
            }}
          >
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Bu domain, business public sitesine yönlenir. Çalışması için ana SaaS uygulaması
              production ortamında yayında olmalıdır.
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Hostname</span>
              <input
                className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                onChange={(event) => setHostname(event.target.value)}
                placeholder="firma.com"
                value={hostname}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ActionButton disabled={isPending || !hostname.trim()} type="submit">
                Kaydet
              </ActionButton>
              <ActionButton
                disabled={isPending || !currentHostname}
                tone="secondary"
                type="button"
                onClick={() => void submit("check_dns")}
              >
                DNS Kontrol Et
              </ActionButton>
              <ActionButton
                disabled={isPending || !currentHostname}
                tone="secondary"
                type="button"
                onClick={() => void submit("check_ssl")}
              >
                SSL Kontrol Et
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
              <MetaItem label="Provider" value={business.domainProvider === "vercel" ? "Vercel" : "Manual"} />
              <MetaItem label="Provider status" value={business.domainProviderStatus ?? "-"} />
              <MetaItem label="Verified at" value={formatDateTime(business.verifiedAt)} />
              <MetaItem label="Activated at" value={formatDateTime(business.activatedAt)} />
              <MetaItem label="Last check" value={formatDateTime(business.lastCheckedAt)} />
              <MetaItem label="SSL status" value={sslLabel} />
            </div>

            {business.domainProviderStatus === "manual" ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                Vercel env bulunmadığı için domain provider otomasyonu manuel modda çalışıyor.
              </div>
            ) : null}

            {activeLink ? (
              <a
                className={[
                  "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition",
                  isOpenable && activeLink
                    ? "bg-slate-950 text-white hover:bg-slate-800"
                    : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400",
                ].join(" ")}
                href={isOpenable && activeLink ? activeLink : undefined}
                rel="noreferrer"
                target={isOpenable && activeLink ? "_blank" : undefined}
                onClick={(event) => {
                  if (!isOpenable || !activeLink) {
                    event.preventDefault();
                  }
                }}
              >
                Siteyi Aç
              </a>
            ) : (
              <button
                className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
                disabled
                type="button"
              >
                Siteyi Aç
              </button>
            )}
          </form>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Sağlayıcı rehberi
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {adapter.label}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            DNS kayıtlarını sağlayıcıya göre kopyalayın, ardından DNS ve SSL kontrollerini
            çalıştırın.
          </p>

          <div className="mt-5 grid gap-2">
            {DOMAIN_PROVIDER_OPTIONS.map((item) => {
              const active = provider === item.value;
              return (
                <button
                  key={item.value}
                  className={[
                    "rounded-2xl border px-4 py-3 text-left transition",
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  ].join(" ")}
                  type="button"
                  onClick={() => setProvider(item.value)}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className={["mt-1 text-xs leading-5", active ? "text-slate-200" : "text-slate-500"].join(" ")}>
                    {item.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                DNS kayıtları
              </p>
              <button
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                type="button"
                onClick={() => {
                  void copyToClipboard(
                    adapter.records
                      .map((record) => `${record.type} ${record.host} ${record.value}`)
                      .join("\n"),
                  );
                }}
              >
                Tümünü kopyala
              </button>
            </div>

            {adapter.records.map((record) => {
              const recordKey = `${record.type}-${record.host}-${record.value}`;
              const isCopied = copied === recordKey;

              return (
                <div
                  key={recordKey}
                  className="rounded-[20px] border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{record.type}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                        {record.host}
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                      {record.note}
                    </span>
                  </div>

                  <div className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {record.value}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton
                      label="Host kopyala"
                      onClick={async () => {
                        await copyToClipboard(record.host);
                        setCopied(recordKey);
                        setTimeout(() => setCopied(null), 1200);
                      }}
                    />
                    <CopyButton
                      label="Değeri kopyala"
                      onClick={async () => {
                        await copyToClipboard(record.value);
                        setCopied(recordKey);
                        setTimeout(() => setCopied(null), 1200);
                      }}
                    />
                    <span className="self-center text-xs text-emerald-700">
                      {isCopied ? "Kopyalandı" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyableField label="Hostname" value={currentHostname || "-"} />
              <CopyableField label="Verification token" value={business.verificationToken ?? "-"} />
            </div>
            <p className="text-xs leading-6 text-slate-500">
              TXT doğrulama kaydı otomatik üretilir. Root domain için A kaydı, subdomain için CNAME
              kaydı önerilir.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-slate-950">{value}</div>
    </div>
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

function CopyableField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 break-words text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  tone = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <button
      {...props}
      className={[
        "inline-flex h-12 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        tone === "danger"
          ? "border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
          : tone === "secondary"
            ? "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950"
            : "bg-slate-950 text-white hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function CopyButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => Promise<void> | void;
}) {
  return (
    <button
      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
      type="button"
      onClick={() => {
        void onClick();
      }}
    >
      {label}
    </button>
  );
}
