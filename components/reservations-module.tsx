"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ReservationRecord } from "@/lib/reservation-types";
import {
  buildReservationCreatePayload,
  mapReservationApiFieldErrorsToUi,
} from "@/lib/reservation-field-map";
import {
  RESERVATION_CURRENCY_OPTIONS,
  RESERVATION_LABELS,
  RESERVATION_PAYMENT_STATUS_OPTIONS,
  RESERVATION_STATUS_OPTIONS,
} from "@/lib/reservation-ui";

type Props = {
  businessId: string;
  initialReservations: ReservationRecord[];
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type ReservationFormState = {
  customerName: string;
  phone: string;
  email: string;
  country: string;
  language: string;
  from: string;
  to: string;
  date: string;
  time: string;
  flightCode: string;
  adultCount: string;
  childCount: string;
  babyCount: string;
  vehicleCategory: string;
  vehicle: string;
  totalAmount: string;
  depositAmount: string;
  remainingAmount: string;
  currency: string;
  notes: string;
  paymentStatus: string;
  status: string;
};

type ReservationUpdateState = {
  bookingStatus: string;
  paymentStatus: string;
  vehicleCategory: string;
  vehicleName: string;
  assignedVehicle: string;
  driverName: string;
  pickupStatus: string;
  operationNotes: string;
  notes: string;
};

type ReservationDateFilter = "all" | "today" | "tomorrow" | "week";
type ReservationStatusFilter = "all" | string;
type ReservationPaymentFilter = "all" | string;
type TaskFormState = {
  title: string;
  description: string;
  reservationId: string;
  customerName: string;
  dueDate: string;
  dueTime: string;
  priority: string;
  status: string;
};

function emptyCreateForm(): ReservationFormState {
  return {
    customerName: "",
    phone: "",
    email: "",
    country: "",
    language: "tr",
    from: "",
    to: "",
    date: "",
    time: "",
    flightCode: "",
    adultCount: "1",
    childCount: "0",
    babyCount: "0",
    vehicleCategory: "",
    vehicle: "",
    totalAmount: "",
    depositAmount: "",
    remainingAmount: "",
    currency: "TRY",
    notes: "",
    paymentStatus: "Ödenmedi",
    status: "Bekliyor",
  };
}

function emptyTaskForm(): TaskFormState {
  return {
    title: "",
    description: "",
    reservationId: "",
    customerName: "",
    dueDate: "",
    dueTime: "",
    priority: "Normal",
    status: "Bekliyor",
  };
}

function createUpdateState(reservation: ReservationRecord): ReservationUpdateState {
  return {
    bookingStatus: reservation.bookingStatus || "Bekliyor",
    paymentStatus: reservation.paymentStatus || "Ödenmedi",
    vehicleCategory: reservation.vehicleCategory ?? "",
    vehicleName: reservation.vehicleName ?? "",
    assignedVehicle: reservation.assignedVehicle ?? "",
    driverName: reservation.driverName ?? "",
    pickupStatus: reservation.pickupStatus ?? "",
    operationNotes: reservation.operationNotes ?? "",
    notes: reservation.notes ?? "",
  };
}

function text(value: string | number | null | undefined) {
  const safe = String(value ?? "").trim();
  return safe || "-";
}

function formatMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency ?? "TRY"}`;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function reservationRoute(reservation: ReservationRecord) {
  return `${text(reservation.origin)} → ${text(reservation.destination)}`;
}

function buildReservationSearchText(reservation: ReservationRecord) {
  return [
    reservation.customerName,
    reservation.phone,
    reservation.origin,
    reservation.destination,
    reservation.flightCode,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function matchesReservationFilters(
  reservation: ReservationRecord,
  filters: {
    query: string;
    dateFilter: ReservationDateFilter;
    statusFilter: ReservationStatusFilter;
    paymentFilter: ReservationPaymentFilter;
    todayKey: string;
  },
) {
  const travelKey = reservation.travelDate?.trim() ?? "";
  const tomorrowKey = toDateKey(addDays(new Date(), 1));
  const weekEndKey = toDateKey(addDays(new Date(), 6));
  const query = filters.query.trim().toLowerCase();

  const matchesDate =
    filters.dateFilter === "all"
      ? true
      : filters.dateFilter === "today"
        ? travelKey === filters.todayKey
        : filters.dateFilter === "tomorrow"
          ? travelKey === tomorrowKey
          : travelKey >= filters.todayKey && travelKey <= weekEndKey;

  const matchesStatus =
    filters.statusFilter === "all" || reservation.bookingStatus === filters.statusFilter;

  const matchesPayment =
    filters.paymentFilter === "all" || reservation.paymentStatus === filters.paymentFilter;

  const matchesQuery = !query || buildReservationSearchText(reservation).includes(query);

  return matchesDate && matchesStatus && matchesPayment && matchesQuery;
}

function formatApiError(body: unknown) {
  if (typeof body === "string") {
    return body;
  }

  if (!body || typeof body !== "object") {
    return RESERVATION_LABELS.createError;
  }

  const response = body as {
    message?: string;
    error?: string;
    code?: string;
    fieldErrors?: Record<string, string>;
  };

  const parts = [response.message ?? response.error ?? RESERVATION_LABELS.createError];
  const mappedFieldErrors = mapReservationApiFieldErrorsToUi(response.fieldErrors);

  if (response.code) {
    parts.push(`[${response.code}]`);
  }

  if (Object.keys(mappedFieldErrors).length > 0) {
    parts.push(
      Object.entries(mappedFieldErrors)
        .map(([key, value]) => {
          const label = RESERVATION_LABELS[key as keyof typeof RESERVATION_LABELS] ?? key;
          return `${label}: ${value}`;
        })
        .join(" | "),
    );
  }

  return parts.join(" ");
}

async function readResponseBody(response: Response) {
  const textBody = await response.text().catch(() => "");

  if (!textBody.trim()) {
    return null;
  }

  try {
    return JSON.parse(textBody) as unknown;
  } catch {
    return textBody;
  }
}

export function ReservationsModule({ initialReservations }: Props) {
  const router = useRouter();
  void initialReservations;
  const [reservations, setReservations] = useState<ReservationRecord[]>(
    initialReservations,
  );
  const [createForm, setCreateForm] = useState<ReservationFormState>(
    emptyCreateForm(),
  );
  const [createState, setCreateState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>(
    {},
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, ReservationUpdateState>>(
    {},
  );
  const [editState, setEditState] = useState<SaveState>({
    status: "idle",
    message: "",
  });
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<ReservationDateFilter>("today");
  const [statusFilter, setStatusFilter] = useState<ReservationStatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<ReservationPaymentFilter>("all");
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm());
  const [taskState, setTaskState] = useState<SaveState>({ status: "idle", message: "" });
  const [taskReservationId, setTaskReservationId] = useState<string | null>(null);

  const todayKey = toDateKey(new Date());

  const sortedReservations = useMemo(() => {
    return [...reservations].sort((left, right) => {
      const leftStamp = `${left.travelDate ?? ""} ${left.travelTime ?? ""}`;
      const rightStamp = `${right.travelDate ?? ""} ${right.travelTime ?? ""}`;
      return rightStamp.localeCompare(leftStamp) || right.createdAt.localeCompare(left.createdAt);
    });
  }, [reservations]);

  const filteredReservations = useMemo(() => {
    return sortedReservations.filter((reservation) =>
      matchesReservationFilters(reservation, {
        query,
        dateFilter,
        statusFilter,
        paymentFilter,
        todayKey,
      }),
    );
  }, [sortedReservations, query, dateFilter, statusFilter, paymentFilter, todayKey]);

  async function refreshReservations() {
    const response = await fetch("/api/business/reservations", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    const body = await readResponseBody(response);

    if (!response.ok) {
      throw new Error(formatApiError(body));
    }

    const next = (body as { reservations?: ReservationRecord[] } | null)?.reservations ?? [];
    setReservations(next);
  }

  function openTaskForm(reservation: ReservationRecord) {
    setTaskReservationId(reservation.id);
    setTaskForm({
      title: `${reservation.customerName} için görev`,
      description: `${text(reservation.origin)} → ${text(reservation.destination)}`,
      reservationId: reservation.id,
      customerName: reservation.customerName,
      dueDate: reservation.travelDate ?? "",
      dueTime: reservation.travelTime ?? "",
      priority: "Normal",
      status: "Bekliyor",
    });
    setTaskState({ status: "idle", message: "" });
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTaskState({ status: "saving", message: "Kaydediliyor..." });

    try {
      const response = await fetch("/api/business/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "create",
          title: taskForm.title,
          description: taskForm.description,
          reservationId: taskForm.reservationId,
          customerName: taskForm.customerName,
          dueDate: taskForm.dueDate,
          dueTime: taskForm.dueTime,
          priority: taskForm.priority,
          status: taskForm.status,
        }),
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        const payload = body as { message?: string; code?: string } | string | null;
        setTaskState({
          status: "error",
          message:
            typeof payload === "string"
              ? payload
              : payload?.message ?? payload?.code ?? "Görev oluşturulamadı.",
        });
        return;
      }

      setTaskState({ status: "success", message: "Görev oluşturuldu." });
      setTaskForm(emptyTaskForm());
      setTaskReservationId(null);
    } catch (error) {
      setTaskState({
        status: "error",
        message: error instanceof Error ? error.message : "Görev oluşturulamadı.",
      });
    }
  }

  async function patchReservation(
    reservationId: string,
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setEditState({ status: "saving", message: "Kaydediliyor..." });

    try {
      const response = await fetch(`/api/business/reservations/${reservationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "update",
          section: "reservation",
          payload,
        }),
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        setEditState({
          status: "error",
          message: formatApiError(body),
        });
        return false;
      }

      await refreshReservations();
      setEditState({
        status: "success",
        message: successMessage,
      });
      return true;
    } catch (error) {
      setEditState({
        status: "error",
        message: error instanceof Error ? error.message : RESERVATION_LABELS.updateError,
      });
      return false;
    }
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const payload = buildReservationCreatePayload({
        customerName: createForm.customerName,
        phone: createForm.phone,
        email: createForm.email,
        country: createForm.country,
        language: createForm.language,
        from: createForm.from,
        to: createForm.to,
        date: createForm.date,
        time: createForm.time,
        flightCode: createForm.flightCode,
        adults: createForm.adultCount,
        children: createForm.childCount,
        babies: createForm.babyCount,
        vehicleCategory: createForm.vehicleCategory,
        vehicle: createForm.vehicle,
        totalAmount: createForm.totalAmount,
        depositAmount: createForm.depositAmount,
        remainingAmount: createForm.remainingAmount,
        currency: createForm.currency,
        paymentStatus: createForm.paymentStatus,
        notes: createForm.notes,
        status: createForm.status,
      });

      console.log("FINAL RESERVATION PAYLOAD", payload);

      setCreateState({ status: "saving", message: "" });
      setCreateFieldErrors({});

      const response = await fetch("/api/business/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "create",
          section: "reservation",
          payload,
        }),
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        const responseBody = body as
          | {
              message?: string;
              code?: string;
              fieldErrors?: Record<string, string>;
            }
          | string
          | null;

        setCreateState({
          status: "error",
          message: formatApiError(responseBody),
        });
        setCreateFieldErrors(
          typeof responseBody === "object" && responseBody && "fieldErrors" in responseBody
            ? mapReservationApiFieldErrorsToUi(
                (responseBody.fieldErrors as Record<string, string>) ?? {},
              )
            : {},
        );
        return;
      }

      setCreateForm(emptyCreateForm());
      setCreateFieldErrors({});
      await refreshReservations();
      setCreateState({
        status: "success",
        message: RESERVATION_LABELS.createSuccess,
      });
    } catch (error) {
      setCreateState({
        status: "error",
        message: error instanceof Error ? error.message : RESERVATION_LABELS.createError,
      });
    }
  }

  async function submitUpdate(reservationId: string) {
    const draft = editForms[reservationId];

    if (!draft) {
      return;
    }

    const ok = await patchReservation(
      reservationId,
      {
        bookingStatus: draft.bookingStatus,
        paymentStatus: draft.paymentStatus,
        vehicleCategory: draft.vehicleCategory,
        vehicleName: draft.vehicleName,
        assignedVehicle: draft.assignedVehicle,
        driverName: draft.driverName,
        pickupStatus: draft.pickupStatus,
        operationNotes: draft.operationNotes,
        notes: draft.notes,
      },
      RESERVATION_LABELS.updateSuccess,
    );

    if (ok) {
      setEditingId(null);
    }
  }

  function startEdit(reservation: ReservationRecord) {
    setEditingId(reservation.id);
    setEditForms((current) => ({
      ...current,
      [reservation.id]: createUpdateState(reservation),
    }));
    setEditState({ status: "idle", message: "" });
  }

  async function quickUpdate(
    reservationId: string,
    key: "bookingStatus" | "paymentStatus",
    value: string,
  ) {
    const currentReservation = reservations.find((item) => item.id === reservationId);

    if (!currentReservation) {
      return;
    }

    setEditForms((current) => ({
      ...current,
      [reservationId]: {
        ...(current[reservationId] ?? createUpdateState(currentReservation)),
        [key]: value,
      },
    }));

    await patchReservation(reservationId, { [key]: value }, RESERVATION_LABELS.updateSuccess);
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-1">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
            {RESERVATION_LABELS.pageTitle}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Yeni rezervasyon
          </h2>
          <p className="text-sm text-slate-600">{RESERVATION_LABELS.pageDescription}</p>
        </div>

        {createState.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              createState.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {createState.message}
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={submitCreate}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label={RESERVATION_LABELS.customerName}
              name="customerName"
              value={createForm.customerName}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, customerName: value }))
              }
              error={createFieldErrors.customerName}
            />
            <Field
              label={RESERVATION_LABELS.phone}
              name="phone"
              value={createForm.phone}
              onChange={(value) => setCreateForm((current) => ({ ...current, phone: value }))}
            />
            <Field
              label={RESERVATION_LABELS.email}
              name="email"
              type="email"
              value={createForm.email}
              onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))}
            />
            <Field
              label={RESERVATION_LABELS.country}
              name="country"
              value={createForm.country}
              onChange={(value) => setCreateForm((current) => ({ ...current, country: value }))}
            />
            <Field
              label={RESERVATION_LABELS.language}
              name="language"
              value={createForm.language}
              onChange={(value) => setCreateForm((current) => ({ ...current, language: value }))}
            />
            <Field
              label={RESERVATION_LABELS.from}
              name="from"
              value={createForm.from}
              onChange={(value) => setCreateForm((current) => ({ ...current, from: value }))}
              error={createFieldErrors.from}
            />
            <Field
              label={RESERVATION_LABELS.to}
              name="to"
              value={createForm.to}
              onChange={(value) => setCreateForm((current) => ({ ...current, to: value }))}
              error={createFieldErrors.to}
            />
            <Field
              label={RESERVATION_LABELS.date}
              name="date"
              type="date"
              value={createForm.date}
              onChange={(value) => setCreateForm((current) => ({ ...current, date: value }))}
              error={createFieldErrors.date}
            />
            <Field
              label={RESERVATION_LABELS.time}
              name="time"
              type="time"
              value={createForm.time}
              onChange={(value) => setCreateForm((current) => ({ ...current, time: value }))}
              error={createFieldErrors.time}
            />
            <Field
              label={RESERVATION_LABELS.flightCode}
              name="flightCode"
              value={createForm.flightCode}
              onChange={(value) => setCreateForm((current) => ({ ...current, flightCode: value }))}
            />
            <Field
              label={RESERVATION_LABELS.adults}
              name="adultCount"
              type="number"
              value={createForm.adultCount}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, adultCount: value }))
              }
            />
            <Field
              label={RESERVATION_LABELS.children}
              name="childCount"
              type="number"
              value={createForm.childCount}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, childCount: value }))
              }
            />
            <Field
              label={RESERVATION_LABELS.infants}
              name="babyCount"
              type="number"
              value={createForm.babyCount}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, babyCount: value }))
              }
            />
            <Field
              label={RESERVATION_LABELS.vehicleCategory}
              name="vehicleCategory"
              value={createForm.vehicleCategory}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, vehicleCategory: value }))
              }
            />
            <Field
              label={RESERVATION_LABELS.vehicleName}
              name="vehicle"
              value={createForm.vehicle}
              onChange={(value) => setCreateForm((current) => ({ ...current, vehicle: value }))}
            />
            <Field
              label={RESERVATION_LABELS.total}
              name="totalAmount"
              type="number"
              value={createForm.totalAmount}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, totalAmount: value }))
              }
            />
            <Field
              label={RESERVATION_LABELS.deposit}
              name="depositAmount"
              type="number"
              value={createForm.depositAmount}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, depositAmount: value }))
              }
            />
            <Field
              label={RESERVATION_LABELS.remaining}
              name="remainingAmount"
              type="number"
              value={createForm.remainingAmount}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, remainingAmount: value }))
              }
            />
            <SelectField
              label={RESERVATION_LABELS.currency}
              name="currency"
              value={createForm.currency}
              options={RESERVATION_CURRENCY_OPTIONS}
              onChange={(value) => setCreateForm((current) => ({ ...current, currency: value }))}
            />
            <SelectField
              label={RESERVATION_LABELS.paymentStatus}
              name="paymentStatus"
              value={createForm.paymentStatus}
              options={RESERVATION_PAYMENT_STATUS_OPTIONS}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, paymentStatus: value }))
              }
            />
            <SelectField
              label={RESERVATION_LABELS.status}
              name="status"
              value={createForm.status}
              options={RESERVATION_STATUS_OPTIONS}
              onChange={(value) => setCreateForm((current) => ({ ...current, status: value }))}
            />
          </div>

          <TextArea
            label={RESERVATION_LABELS.notes}
            name="notes"
            value={createForm.notes}
            onChange={(value) => setCreateForm((current) => ({ ...current, notes: value }))}
          />

          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={createState.status === "saving"}
          >
            {RESERVATION_LABELS.create}
          </button>
        </form>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Liste
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Rezervasyonlar
            </h2>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            type="button"
            onClick={() => void refreshReservations()}
          >
            Yenile
          </button>
        </div>

        <div className="grid gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Ara</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Müşteri adı, telefon, rota, uçuş kodu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Durum"
                name="statusFilter"
                value={statusFilter}
                options={["all", ...RESERVATION_STATUS_OPTIONS]}
                onChange={(value) => setStatusFilter(value)}
              />
              <SelectField
                label="Ödeme durumu"
                name="paymentFilter"
                value={paymentFilter}
                options={["all", ...RESERVATION_PAYMENT_STATUS_OPTIONS]}
                onChange={(value) => setPaymentFilter(value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ChipButton active={dateFilter === "today"} onClick={() => setDateFilter("today")}>
              Bugün
            </ChipButton>
            <ChipButton
              active={dateFilter === "tomorrow"}
              onClick={() => setDateFilter("tomorrow")}
            >
              Yarın
            </ChipButton>
            <ChipButton active={dateFilter === "week"} onClick={() => setDateFilter("week")}>
              Bu hafta
            </ChipButton>
            <ChipButton active={dateFilter === "all"} onClick={() => setDateFilter("all")}>
              Tüm rezervasyonlar
            </ChipButton>
          </div>
        </div>

        {editState.message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              editState.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : editState.status === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-700"
            }`}
          >
            {editState.message}
          </div>
        ) : null}

        {taskReservationId ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Görev oluştur
                </div>
                <h3 className="text-lg font-semibold text-slate-950">Rezervasyona bağlı görev</h3>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => {
                  setTaskReservationId(null);
                  setTaskForm(emptyTaskForm());
                  setTaskState({ status: "idle", message: "" });
                }}
              >
                Kapat
              </button>
            </div>
            {taskState.message ? (
              <div
                className={`mb-3 rounded-2xl border px-4 py-3 text-sm ${
                  taskState.status === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : taskState.status === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                }`}
              >
                {taskState.message}
              </div>
            ) : null}
            <form className="grid gap-3" onSubmit={submitTask}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="Başlık"
                  name="taskTitle"
                  value={taskForm.title}
                  onChange={(value) => setTaskForm((current) => ({ ...current, title: value }))}
                />
                <Field
                  label="Müşteri"
                  name="taskCustomer"
                  value={taskForm.customerName}
                  onChange={(value) =>
                    setTaskForm((current) => ({ ...current, customerName: value }))
                  }
                />
                <Field
                  label="İlgili rezervasyon"
                  name="taskReservation"
                  value={taskForm.reservationId}
                  onChange={(value) =>
                    setTaskForm((current) => ({ ...current, reservationId: value }))
                  }
                />
                <Field
                  label="Tarih"
                  name="taskDueDate"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(value) => setTaskForm((current) => ({ ...current, dueDate: value }))}
                />
                <Field
                  label="Saat"
                  name="taskDueTime"
                  type="time"
                  value={taskForm.dueTime}
                  onChange={(value) => setTaskForm((current) => ({ ...current, dueTime: value }))}
                />
                <SelectField
                  label="Öncelik"
                  name="taskPriority"
                  value={taskForm.priority}
                  options={["Düşük", "Normal", "Yüksek", "Acil"]}
                  onChange={(value) => setTaskForm((current) => ({ ...current, priority: value }))}
                />
                <SelectField
                  label="Durum"
                  name="taskStatus"
                  value={taskForm.status}
                  options={["Bekliyor", "Devam Ediyor", "Tamamlandı", "İptal"]}
                  onChange={(value) => setTaskForm((current) => ({ ...current, status: value }))}
                />
              </div>
              <TextArea
                label="Açıklama"
                name="taskDescription"
                value={taskForm.description}
                onChange={(value) =>
                  setTaskForm((current) => ({ ...current, description: value }))
                }
              />
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={taskState.status === "saving"}
              >
                Görev oluştur
              </button>
            </form>
          </div>
        ) : null}

        <div className="grid gap-3">
          {filteredReservations.length ? (
            filteredReservations.map((reservation) => {
              const isEditing = editingId === reservation.id;
              const draft = editForms[reservation.id] ?? createUpdateState(reservation);

              return (
                <article
                  key={reservation.id}
                  className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                      <div className="text-lg font-semibold text-slate-950">
                        {reservation.customerName}
                      </div>
                      <div className="text-sm text-slate-600">{text(reservation.phone)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{text(reservation.bookingStatus)}</Badge>
                      <Badge>{text(reservation.paymentStatus)}</Badge>
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-3">
                    <Info label="Rota" value={reservationRoute(reservation)} />
                    <Info
                      label="Tarih / Saat"
                      value={`${text(reservation.travelDate)} ${text(reservation.travelTime)}`}
                    />
                    <Info label="Uçuş kodu" value={text(reservation.flightCode)} />
                    <Info label="Araç" value={text(reservation.vehicleName)} />
                    <Info
                      label="Yolcu"
                      value={`${reservation.adultCount} yetişkin, ${reservation.childCount} çocuk, ${reservation.babyCount} bebek`}
                    />
                    <Info label="Para birimi" value={text(reservation.currency)} />
                    <Info label="Toplam" value={formatMoney(reservation.totalAmount, reservation.currency)} />
                    <Info
                      label="Kapora / Kalan"
                      value={`${formatMoney(reservation.depositAmount, reservation.currency)} / ${formatMoney(reservation.remainingAmount, reservation.currency)}`}
                    />
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    <SelectField
                      label="Durum değiştir"
                      name={`status-${reservation.id}`}
                      value={draft.bookingStatus}
                      options={RESERVATION_STATUS_OPTIONS}
                      onChange={(value) => void quickUpdate(reservation.id, "bookingStatus", value)}
                    />
                    <SelectField
                      label="Ödeme durumu değiştir"
                      name={`payment-${reservation.id}`}
                      value={draft.paymentStatus}
                      options={RESERVATION_PAYMENT_STATUS_OPTIONS}
                      onChange={(value) => void quickUpdate(reservation.id, "paymentStatus", value)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      type="button"
                      onClick={() => router.push(`/app/reservations/${reservation.id}/voucher`)}
                    >
                      Voucher aç
                    </button>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      type="button"
                      onClick={() => (isEditing ? setEditingId(null) : startEdit(reservation))}
                    >
                      {isEditing ? "Kapat" : "Düzenle"}
                    </button>
                    <button
                      className="inline-flex h-10 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
                      type="button"
                      onClick={() => openTaskForm(reservation)}
                    >
                      Görev oluştur
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Field
                          label="Araç kategorisi"
                          name={`vehicleCategory-${reservation.id}`}
                          value={draft.vehicleCategory}
                          onChange={(value) =>
                            setEditForms((current) => ({
                              ...current,
                              [reservation.id]: { ...draft, vehicleCategory: value },
                            }))
                          }
                        />
                        <Field
                          label="Araç"
                          name={`vehicleName-${reservation.id}`}
                          value={draft.vehicleName}
                          onChange={(value) =>
                            setEditForms((current) => ({
                              ...current,
                              [reservation.id]: { ...draft, vehicleName: value },
                            }))
                          }
                        />
                        <Field
                          label="Atanan araç"
                          name={`assignedVehicle-${reservation.id}`}
                          value={draft.assignedVehicle}
                          onChange={(value) =>
                            setEditForms((current) => ({
                              ...current,
                              [reservation.id]: { ...draft, assignedVehicle: value },
                            }))
                          }
                        />
                        <Field
                          label="Şoför"
                          name={`driverName-${reservation.id}`}
                          value={draft.driverName}
                          onChange={(value) =>
                            setEditForms((current) => ({
                              ...current,
                              [reservation.id]: { ...draft, driverName: value },
                            }))
                          }
                        />
                        <Field
                          label="Pickup notu"
                          name={`pickupStatus-${reservation.id}`}
                          value={draft.pickupStatus}
                          onChange={(value) =>
                            setEditForms((current) => ({
                              ...current,
                              [reservation.id]: { ...draft, pickupStatus: value },
                            }))
                          }
                        />
                      </div>
                      <TextArea
                        label="Operasyon notu"
                        name={`operationNotes-${reservation.id}`}
                        value={draft.operationNotes}
                        onChange={(value) =>
                          setEditForms((current) => ({
                            ...current,
                            [reservation.id]: { ...draft, operationNotes: value },
                          }))
                        }
                      />
                      <TextArea
                        label={RESERVATION_LABELS.notes}
                        name={`notes-${reservation.id}`}
                        value={draft.notes}
                        onChange={(value) =>
                          setEditForms((current) => ({
                            ...current,
                            [reservation.id]: { ...draft, notes: value },
                          }))
                        }
                      />
                      <button
                        className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                        type="button"
                        onClick={() => void submitUpdate(reservation.id)}
                      >
                        {RESERVATION_LABELS.update}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              {RESERVATION_LABELS.empty}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  error?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="text-xs text-rose-600">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
        active
          ? "border border-slate-900 bg-slate-900 text-white"
          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
      }`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Badge({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
      {children}
    </span>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-[22px] border border-slate-200 bg-white p-4">
      <div className="text-[11px] uppercase tracking-[0.24em] text-slate-500">
        {label}
      </div>
      <div className="text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}
