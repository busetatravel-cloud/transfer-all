"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { DomainUpdateForm } from "@/components/domain-update-form";
import type { BusinessListRecord } from "@/lib/business";
import { formatDomainStatusLabel, formatSslStatusLabel } from "@/lib/domain-utils";

type Props = {
  business: BusinessListRecord;
};

type FormState = {
  error: string | null;
  success: string | null;
};

type ActionTarget = "business" | "admin";
type ActionType = "activate" | "deactivate" | "delete";

export function SuperAdminBusinessCard({ business }: Props) {
  const router = useRouter();
  const [state, setState] = useState<FormState>({ error: null, success: null });
  const [isPending, startTransition] = useTransition();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  async function runAction(target: ActionTarget, action: ActionType) {
    if (action === "delete") {
      const confirmed =
        target === "business"
          ? window.confirm(
              "Bu business kalıcı olarak silinecek. Devam etmek istiyor musunuz?",
            )
          : window.confirm(
              "Bu admin hesabini silmek istediginize emin misiniz? Bu islem geri alinamaz.",
            );

      if (!confirmed) {
        return;
      }
    }

    setState({ error: null, success: null });

    const response = await fetch(`/api/super-admin/businesses/${business.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, action }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      setState({
        error: body?.error ?? "Islem basarisiz.",
        success: null,
      });
      return;
    }

    const body = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;

    setState({
      error: null,
      success: body?.message ?? "Islem tamamlandi.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  async function createAdmin() {
    setState({ error: null, success: null });

    const response = await fetch(`/api/super-admin/businesses/${business.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminEmail, adminPassword }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      setState({
        error: body?.error ?? "Admin olusturulamadi.",
        success: null,
      });
      return;
    }

    setAdminEmail("");
    setAdminPassword("");
    setState({
      error: null,
      success: "Admin olusturuldu.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  const admin = business.admin;
  const hasAdmin = Boolean(admin);
  const adminActive = admin?.active ?? false;

  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Business
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900">
            {business.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Business sil"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-base font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-100"
            title="Business sil"
            type="button"
            onClick={() => runAction("business", "delete")}
          >
            🗑
          </button>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              business.active
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {business.active ? "Active" : "Passive"}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600">
        <Detail label="Business email" value={business.email} />
        <Detail label="Domain" value={business.hostname ?? business.domain ?? "Not set"} />
        <Detail label="Status" value={formatDomainStatusLabel(business.domainStatus)} />
        <Detail label="SSL" value={formatSslStatusLabel(business.sslStatus)} />
        <Detail label="Son kontrol" value={formatDateTime(business.lastCheckedAt)} />
        <Detail label="Paket" value={business.packageName ?? "Plan yok"} />
        <Detail
          label="Abonelik durumu"
          value={getSubscriptionStatus(business.packageEnd)}
        />
        <Detail label="Bitiş tarihi" value={formatDateTime(business.packageEnd)} />
        {hasAdmin ? (
          <>
            <Detail label="Admin email" value={admin?.email ?? "Admin yok"} />
            <Detail
              label="Kullanıcı oluşturuldu"
              value={formatDateTime(admin?.createdAt ?? null)}
            />
            <Detail
              label="Şifre gönderildi"
              value={formatDateTime(admin?.passwordChangedAt ?? null)}
            />
            <Detail
              label="Son giriş"
              value={formatDateTime(admin?.lastLoginAt ?? null)}
            />
            <Detail label="Giris sifresi" value={admin?.password || "-"} />
            <Detail label="Admin durumu" value={adminActive ? "Active" : "Passive"} />
          </>
        ) : (
          <>
            <Detail label="Admin email" value="Admin yok" />
            <Detail label="Giris sifresi" value="-" />
            <Detail label="Kullanıcı oluşturuldu" value="Kayitli degil" />
            <Detail label="Şifre gönderildi" value="Kayitli degil" />
            <Detail label="Son giriş" value="Kayitli degil" />
            <Detail label="Admin durumu" value="Silindi" />
          </>
        )}
      </dl>

      <div className="mt-5 border-t border-slate-200 pt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Domain sekmesi
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Public site eslesmesi ve manuel dogrulama bu alandan yonetilir.
        </p>
        <div className="mt-4">
          <DomainUpdateForm
            businessId={business.id}
            domain={business.domain}
            domainStatus={business.domainStatus}
          />
        </div>
      </div>

      <div className="mt-5 border-t border-slate-200 pt-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Aksiyonlar
        </p>
        {state.error ? (
          <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {state.success}
          </p>
        ) : null}

        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-700">
              {hasAdmin ? "Admini yeniden oluştur" : "Admin oluştur"}
            </p>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Admin email</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                placeholder="admin@firma.com"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Admin sifresi</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                placeholder="Yeni sifre"
              />
            </label>
            <ActionButton disabled={isPending} onClick={createAdmin}>
              {hasAdmin ? "Admini yeniden oluştur" : "Admin oluştur"}
            </ActionButton>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ActionButton
              disabled={isPending}
              onClick={() =>
                runAction("business", business.active ? "deactivate" : "activate")
              }
            >
              Business {business.active ? "pasif yap" : "aktif yap"}
            </ActionButton>
            {hasAdmin ? (
              <ActionButton
                disabled={isPending}
                onClick={() => runAction("admin", adminActive ? "deactivate" : "activate")}
              >
                Admin {adminActive ? "pasif yap" : "aktif yap"}
              </ActionButton>
            ) : (
              <div className="flex items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Admin kaydi yok
              </div>
            )}
          </div>
          {hasAdmin ? (
            <ActionButton
              disabled={isPending}
              onClick={() => runAction("admin", "delete")}
              tone="danger"
            >
              Business admin hesabini sil
            </ActionButton>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[60%] truncate font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  const className =
    tone === "danger"
      ? "inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-70"
      : "inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70";

  return (
    <button className={className} disabled={disabled} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Kayitli degil";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Kayitli degil";
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getSubscriptionStatus(endDate: string | null) {
  if (!endDate) {
    return "Aktif";
  }

  const date = new Date(endDate);

  if (Number.isNaN(date.getTime())) {
    return "Aktif";
  }

  return date.getTime() >= Date.now() ? "Aktif" : "Süresi doldu";
}
