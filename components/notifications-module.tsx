"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  BusinessNotificationRecord,
  BusinessNotificationStatus,
  BusinessNotificationType,
} from "@/lib/notifications";

type Props = {
  businessId: string;
  initialNotifications: BusinessNotificationRecord[];
};

type StatusFilter = "all" | BusinessNotificationStatus;
type TypeFilter = "all" | BusinessNotificationType;

const STATUS_LABELS: Record<BusinessNotificationStatus, string> = {
  unread: "Okunmadı",
  read: "Okundu",
};

export function NotificationsModule({ businessId, initialNotifications }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const filteredNotifications = useMemo(() => {
    return notifications
      .filter((item) => (statusFilter === "all" ? true : item.status === statusFilter))
      .filter((item) => (typeFilter === "all" ? true : item.type === typeFilter))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }, [notifications, statusFilter, typeFilter]);

  const typeOptions = useMemo(() => {
    return Array.from(new Set(initialNotifications.map((item) => item.type)));
  }, [initialNotifications]);

  async function updateStatus(notificationId: string, status: BusinessNotificationStatus) {
    setBusyId(notificationId);
    setMessage("");

    try {
      const response = await fetch(`/api/business/notifications/${notificationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; code?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.message || body?.code || "Bildirim güncellenemedi.");
      }

      setNotifications((current) =>
        current.map((item) => (item.id === notificationId ? { ...item, status } : item)),
      );
      setMessage(status === "read" ? "Bildirim okundu." : "Bildirim okunmadı olarak işaretlendi.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bildirim güncellenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="grid gap-6">
      <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Bildirim Merkezi
        </p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
              Business bildirimleri
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
              Bildirimler yalnızca bu businessId için görünür. Okundu ve okunmadı durumları buradan yönetilir.
            </p>
            <p className="mt-2 text-xs text-slate-500">Business ID: {businessId}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all">Tüm durumlar</option>
              <option value="unread">Okunmadı</option>
              <option value="read">Okundu</option>
            </select>
            <select
              className="h-12 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            >
              <option value="all">Tüm tipler</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}
      </article>

      <article className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        {filteredNotifications.length ? (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
            >
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    {notification.type}
                  </span>
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      notification.status === "read"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700",
                    ].join(" ")}
                  >
                    {STATUS_LABELS[notification.status]}
                  </span>
                  {notification.relatedType ? (
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      {notification.relatedType}
                    </span>
                  ) : null}
                </div>

                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  {notification.title}
                </div>
                <div className="text-sm leading-6 text-slate-600">{notification.message}</div>
                <div className="text-xs text-slate-500">
                  {formatDate(notification.createdAt)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:flex-col lg:items-end">
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={busyId === notification.id}
                  onClick={() =>
                    updateStatus(
                      notification.id,
                      notification.status === "read" ? "unread" : "read",
                    )
                  }
                  type="button"
                >
                  {notification.status === "read" ? "Okunmadı yap" : "Okundu yap"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            Gösterilecek bildirim yok.
          </div>
        )}
      </article>
    </section>
  );
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
