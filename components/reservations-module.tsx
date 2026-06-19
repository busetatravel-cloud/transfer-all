"use client";

import { Fragment, useMemo, useState, type FormEvent, type ReactNode } from "react";
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

type ReservationDateFilter = string;
type ReservationStatusFilter = "all" | string;
type ReservationPaymentFilter = "all" | string;
type ReservationDriverFilter = "all" | string;
type ReservationVehicleFilter = "all" | string;
type ReservationSourceFilter = "all" | string;
type ReservationRegionFilter = "all" | string;
type ReservationDirectionFilter = "all" | "outbound" | "return";
type ReservationTypeFilter = "all" | string;
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

type EditMode = "quick" | "full";

const TRANSFER_STATUS_OPTIONS = [
  "Bekliyor",
  "Onaylandı",
  "Şoför Atandı",
  "Tamamlandı",
  "İptal",
] as const;

function normalizeTransferStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  const map: Record<string, string> = {
    "Onaylandı": "Onaylandı",
    "Şoför Atandı": "Şoför Atandı",
    "Tamamlandı": "Tamamlandı",
    "İptal": "İptal",
    onaylandi: "Onaylandı",
    onaylandı: "Onaylandı",
    sofor_atandi: "Şoför Atandı",
    "şoför_atandı": "Şoför Atandı",
    tamamlandi: "Tamamlandı",
    tamamlandı: "Tamamlandı",
    iptal: "İptal",
  };

  return TRANSFER_STATUS_OPTIONS.includes(normalized as (typeof TRANSFER_STATUS_OPTIONS)[number])
    ? normalized
    : map[normalized.toLowerCase()] ?? "Bekliyor";
}

function normalizePaymentStatus(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  const map: Record<string, string> = {
    "Ödenmedi": "Ödenmedi",
    "Kapora Alındı": "Kapora Alındı",
    "Ödendi": "Ödendi",
    "Araçta Tahsil": "Araçta Tahsil",
    "İade": "İade",
    "İptal": "İptal",
    odenmedi: "Ödenmedi",
    ödenmedi: "Ödenmedi",
    kapora_alindi: "Kapora Alındı",
    kapora_alındı: "Kapora Alındı",
    odendi: "Ödendi",
    ödendi: "Ödendi",
    aracta_tahsil: "Araçta Tahsil",
    araçta_tahsil: "Araçta Tahsil",
    iade: "İade",
    iptal: "İptal",
  };

  return RESERVATION_PAYMENT_STATUS_OPTIONS.includes(
    normalized as (typeof RESERVATION_PAYMENT_STATUS_OPTIONS)[number],
  )
    ? normalized
    : map[normalized.toLowerCase()] ?? "Ödenmedi";
}

function normalizeReservationRecord(reservation: ReservationRecord): ReservationRecord {
  return {
    ...reservation,
    bookingStatus: normalizeTransferStatus(reservation.bookingStatus),
    paymentStatus: normalizePaymentStatus(reservation.paymentStatus),
  };
}

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
    bookingStatus: normalizeTransferStatus(reservation.bookingStatus),
    paymentStatus: normalizePaymentStatus(reservation.paymentStatus),
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

function normalizeRouteText(value: string | null | undefined) {
  const safe = String(value ?? "").trim();
  return safe || "-";
}

function reservationRoute(reservation: ReservationRecord) {
  return `${normalizeRouteText(reservation.origin)} → ${normalizeRouteText(reservation.destination)}`;
}

function reservationPax(reservation: ReservationRecord) {
  return reservation.adultCount + reservation.childCount + reservation.babyCount;
}

function directionLabel(reservation: ReservationRecord) {
  const route = `${reservation.origin ?? ""} ${reservation.destination ?? ""}`.toLowerCase();

  if (route.includes("airport") || route.includes("havaalan") || route.includes("havaliman")) {
    return route.includes("hotel") || route.includes("otel") ? "Dönüş" : "Gidiş";
  }

  return "Belirsiz";
}

function parseDirectionFilter(reservation: ReservationRecord, filter: ReservationDirectionFilter) {
  if (filter === "all") {
    return true;
  }

  const direction = directionLabel(reservation);
  return filter === "outbound" ? direction === "Gidiş" : direction === "Dönüş";
}

function buildReservationSearchText(reservation: ReservationRecord) {
  return [
    reservation.customerName,
    reservation.phone,
    reservation.origin,
    reservation.destination,
    reservation.flightCode,
    reservation.driverName,
    reservation.assignedVehicle,
    reservation.vehicleName,
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
    driverFilter: ReservationDriverFilter;
    vehicleFilter: ReservationVehicleFilter;
    sourceFilter: ReservationSourceFilter;
    regionFilter: ReservationRegionFilter;
    directionFilter: ReservationDirectionFilter;
    typeFilter: ReservationTypeFilter;
  },
) {
  const travelKey = reservation.travelDate?.trim() ?? "";
  const query = filters.query.trim().toLowerCase();
  const typeValue = reservation.vehicleCategory ?? "";
  const regionValue = reservation.country ?? "";
  const sourceValue = reservation.source ?? "";
  const vehicleValue = [reservation.vehicleName, reservation.assignedVehicle].filter(Boolean).join(" ");
  const driverValue = reservation.driverName ?? "";

  const matchesDate = !filters.dateFilter || travelKey === filters.dateFilter;

  const matchesStatus =
    filters.statusFilter === "all" || reservation.bookingStatus === filters.statusFilter;
  const matchesPayment =
    filters.paymentFilter === "all" || reservation.paymentStatus === filters.paymentFilter;
  const matchesDriver =
    filters.driverFilter === "all" || driverValue.toLowerCase().includes(filters.driverFilter.toLowerCase());
  const matchesVehicle =
    filters.vehicleFilter === "all" ||
    vehicleValue.toLowerCase().includes(filters.vehicleFilter.toLowerCase());
  const matchesSource =
    filters.sourceFilter === "all" || sourceValue.toLowerCase().includes(filters.sourceFilter.toLowerCase());
  const matchesRegion =
    filters.regionFilter === "all" || regionValue.toLowerCase().includes(filters.regionFilter.toLowerCase());
  const matchesDirection = parseDirectionFilter(reservation, filters.directionFilter);
  const matchesType =
    filters.typeFilter === "all" || typeValue.toLowerCase().includes(filters.typeFilter.toLowerCase());
  const matchesQuery = !query || buildReservationSearchText(reservation).includes(query);

  return (
    matchesDate &&
    matchesStatus &&
    matchesPayment &&
    matchesDriver &&
    matchesVehicle &&
    matchesSource &&
    matchesRegion &&
    matchesDirection &&
    matchesType &&
    matchesQuery
  );
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

function buildWhatsAppDraft(reservation: ReservationRecord) {
  return [
    `Merhaba ${reservation.customerName}`,
    `Rezervasyon no: ${reservation.id}`,
    `Tarih/Saat: ${text(reservation.travelDate)} ${text(reservation.travelTime)}`,
    `Rota: ${reservationRoute(reservation)}`,
    "Voucher link: [voucher-link-placeholder]",
  ].join("\n");
}

export function ReservationsModule({ businessId, initialReservations }: Props) {
  const router = useRouter();
  const [reservations, setReservations] = useState<ReservationRecord[]>(
    initialReservations.map(normalizeReservationRecord),
  );
  const [createForm, setCreateForm] = useState<ReservationFormState>(emptyCreateForm());
  const [createOpen, setCreateOpen] = useState(false);
  const [createState, setCreateState] = useState<SaveState>({ status: "idle", message: "" });
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<EditMode>("quick");
  const [editForms, setEditForms] = useState<Record<string, ReservationUpdateState>>({});
  const [editState, setEditState] = useState<SaveState>({ status: "idle", message: "" });
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<ReservationDateFilter>("");
  const [statusFilter, setStatusFilter] = useState<ReservationStatusFilter>("all");
  const [paymentFilter, setPaymentFilter] = useState<ReservationPaymentFilter>("all");
  const [driverFilter, setDriverFilter] = useState<ReservationDriverFilter>("all");
  const [vehicleFilter, setVehicleFilter] = useState<ReservationVehicleFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<ReservationSourceFilter>("all");
  const [regionFilter, setRegionFilter] = useState<ReservationRegionFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<ReservationDirectionFilter>("all");
  const [typeFilter, setTypeFilter] = useState<ReservationTypeFilter>("all");
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyTaskForm());
  const [taskState, setTaskState] = useState<SaveState>({ status: "idle", message: "" });
  const [taskReservationId, setTaskReservationId] = useState<string | null>(null);
  const [whatsAppDraft, setWhatsAppDraft] = useState<{ id: string; message: string } | null>(null);

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
        driverFilter,
        vehicleFilter,
        sourceFilter,
        regionFilter,
        directionFilter,
        typeFilter,
      }),
    );
  }, [
    sortedReservations,
    query,
    dateFilter,
    statusFilter,
    paymentFilter,
    driverFilter,
    vehicleFilter,
    sourceFilter,
    regionFilter,
    directionFilter,
    typeFilter,
  ]);

  const filterOptions = useMemo(() => {
    const unique = (values: Array<string | null | undefined>) =>
      [...new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "tr"),
      );

    return {
      drivers: unique(reservations.map((item) => item.driverName)),
      vehicles: unique(reservations.flatMap((item) => [item.vehicleName, item.assignedVehicle])),
      sources: unique(reservations.map((item) => item.source)),
      regions: unique(reservations.map((item) => item.country)),
      types: unique(reservations.map((item) => item.vehicleCategory)),
    };
  }, [reservations]);

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
    setReservations(next.map(normalizeReservationRecord));
  }

  function openTaskForm(reservation: ReservationRecord) {
    setTaskReservationId(reservation.id);
    setTaskForm({
      title: `${reservation.customerName} için görev`,
      description: `${reservationRoute(reservation)}`,
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

  async function deleteReservation(reservationId: string) {
    const confirmed = window.confirm("Bu transfer silinecek. Devam etmek istiyor musunuz?");

    if (!confirmed) {
      return;
    }

    setEditState({ status: "saving", message: "Siliniyor..." });

    try {
      const response = await fetch(`/api/business/reservations/${reservationId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      const body = await readResponseBody(response);

      if (!response.ok) {
        setEditState({
          status: "error",
          message: formatApiError(body),
        });
        return;
      }

      await refreshReservations();
      setEditState({ status: "success", message: "Rezervasyon silindi." });
      if (editingId === reservationId) {
        setEditingId(null);
      }
    } catch (error) {
      setEditState({
        status: "error",
        message: error instanceof Error ? error.message : "Rezervasyon silinemedi.",
      });
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
        notes: createForm.notes,
        paymentStatus: createForm.paymentStatus,
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
      setCreateOpen(false);
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

  function startEdit(reservation: ReservationRecord, mode: EditMode) {
    setEditingId(reservation.id);
    setEditingMode(mode);
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

  function prepareWhatsApp(reservation: ReservationRecord) {
    setWhatsAppDraft({
      id: reservation.id,
      message: buildWhatsAppDraft(reservation),
    });
  }

  async function copyWhatsAppDraft() {
    if (!whatsAppDraft) {
      return;
    }

    await navigator.clipboard.writeText(whatsAppDraft.message);
    setEditState({ status: "success", message: "WhatsApp mesajı kopyalandı." });
  }

  return (
    <section className="grid gap-6" data-business-id={businessId}>
      {editState.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            editState.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {editState.message}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid gap-1">
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
              {RESERVATION_LABELS.pageTitle}
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
              Rezervasyonlar
            </h2>
            <p className="text-sm text-slate-600">
              Rezervasyonlar tablo halinde izlenir, filtrelenir ve hızlı aksiyonlarla yönetilir.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              type="button"
              onClick={() => window.print()}
            >
              PDF Yazdır
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              type="button"
              onClick={() => setCreateOpen((current) => !current)}
            >
              {createOpen ? "Rezervasyon Oluşturmayı Kapat" : "Rezervasyon Oluştur"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 xl:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Arama</span>
              <input
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                placeholder="Müşteri, telefon, rota, uçuş kodu"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="grid gap-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Tarih</span>
                <input
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-slate-400"
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                />
              </label>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                type="button"
                onClick={() => setDateFilter("")}
              >
                Temizle
              </button>
            </div>
            <SelectField label="Transfer durumu" value={statusFilter} onChange={(value) => setStatusFilter(value)} options={["all", ...TRANSFER_STATUS_OPTIONS]} />
          </div>

          <div className="grid gap-3 xl:grid-cols-4">
            <SelectField
              label="Şoför"
              value={driverFilter}
              onChange={(value) => setDriverFilter(value)}
              options={["all", ...filterOptions.drivers]}
            />
            <SelectField
              label="Araç"
              value={vehicleFilter}
              onChange={(value) => setVehicleFilter(value)}
              options={["all", ...filterOptions.vehicles]}
            />
            <SelectField
              label="Kaynak"
              value={sourceFilter}
              onChange={(value) => setSourceFilter(value)}
              options={["all", ...filterOptions.sources]}
            />
            <SelectField
              label="Bölge"
              value={regionFilter}
              onChange={(value) => setRegionFilter(value)}
              options={["all", ...filterOptions.regions]}
            />
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <SelectField
              label="Ödeme durumu"
              value={paymentFilter}
              onChange={(value) => setPaymentFilter(value)}
              options={["all", ...RESERVATION_PAYMENT_STATUS_OPTIONS]}
            />
            <SelectField
              label="Yön"
              value={directionFilter}
              onChange={(value) => setDirectionFilter(value as ReservationDirectionFilter)}
              options={["all", "outbound", "return"]}
            />
            <SelectField
              label="Tip"
              value={typeFilter}
              onChange={(value) => setTypeFilter(value)}
              options={["all", ...filterOptions.types]}
            />
          </div>
        </div>

        {createOpen ? (
          <form className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm" onSubmit={submitCreate}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Rezervasyon Oluştur</div>
                <h3 className="text-lg font-semibold text-slate-950">Rezervasyon Oluştur</h3>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                type="button"
                onClick={() => setCreateOpen(false)}
              >
                Kapat
              </button>
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

            <div className="grid gap-4">
              <FormSection title="Ana Bilgi">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label={RESERVATION_LABELS.customerName} value={createForm.customerName} onChange={(value) => setCreateForm((current) => ({ ...current, customerName: value }))} error={createFieldErrors.customerName} />
                  <Field label={RESERVATION_LABELS.phone} value={createForm.phone} onChange={(value) => setCreateForm((current) => ({ ...current, phone: value }))} />
                  <Field label={RESERVATION_LABELS.email} type="email" value={createForm.email} onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))} />
                  <Field label={RESERVATION_LABELS.country} value={createForm.country} onChange={(value) => setCreateForm((current) => ({ ...current, country: value }))} />
                  <Field label={RESERVATION_LABELS.language} value={createForm.language} onChange={(value) => setCreateForm((current) => ({ ...current, language: value }))} />
                  <Field label={RESERVATION_LABELS.from} value={createForm.from} onChange={(value) => setCreateForm((current) => ({ ...current, from: value }))} error={createFieldErrors.from} />
                  <Field label={RESERVATION_LABELS.to} value={createForm.to} onChange={(value) => setCreateForm((current) => ({ ...current, to: value }))} error={createFieldErrors.to} />
                  <Field label={RESERVATION_LABELS.date} type="date" value={createForm.date} onChange={(value) => setCreateForm((current) => ({ ...current, date: value }))} error={createFieldErrors.date} />
                  <Field label={RESERVATION_LABELS.time} type="time" value={createForm.time} onChange={(value) => setCreateForm((current) => ({ ...current, time: value }))} error={createFieldErrors.time} />
                  <Field label={RESERVATION_LABELS.flightCode} value={createForm.flightCode} onChange={(value) => setCreateForm((current) => ({ ...current, flightCode: value }))} />
                  <Field label={RESERVATION_LABELS.adults} type="number" value={createForm.adultCount} onChange={(value) => setCreateForm((current) => ({ ...current, adultCount: value }))} />
                  <Field label={RESERVATION_LABELS.children} type="number" value={createForm.childCount} onChange={(value) => setCreateForm((current) => ({ ...current, childCount: value }))} />
                  <Field label={RESERVATION_LABELS.infants} type="number" value={createForm.babyCount} onChange={(value) => setCreateForm((current) => ({ ...current, babyCount: value }))} />
                </div>
              </FormSection>

              <FormSection title="Fiyat & Kâr">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label={RESERVATION_LABELS.vehicleCategory} value={createForm.vehicleCategory} onChange={(value) => setCreateForm((current) => ({ ...current, vehicleCategory: value }))} />
                  <Field label={RESERVATION_LABELS.vehicleName} value={createForm.vehicle} onChange={(value) => setCreateForm((current) => ({ ...current, vehicle: value }))} />
                  <Field label={RESERVATION_LABELS.total} type="number" value={createForm.totalAmount} onChange={(value) => setCreateForm((current) => ({ ...current, totalAmount: value }))} />
                  <Field label={RESERVATION_LABELS.deposit} type="number" value={createForm.depositAmount} onChange={(value) => setCreateForm((current) => ({ ...current, depositAmount: value }))} />
                  <Field label={RESERVATION_LABELS.remaining} type="number" value={createForm.remainingAmount} onChange={(value) => setCreateForm((current) => ({ ...current, remainingAmount: value }))} />
                  <SelectField label={RESERVATION_LABELS.currency} value={createForm.currency} options={RESERVATION_CURRENCY_OPTIONS} onChange={(value) => setCreateForm((current) => ({ ...current, currency: value }))} />
                </div>
              </FormSection>

              <FormSection title="Operasyon">
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField label={RESERVATION_LABELS.paymentStatus} value={createForm.paymentStatus} options={RESERVATION_PAYMENT_STATUS_OPTIONS} onChange={(value) => setCreateForm((current) => ({ ...current, paymentStatus: value }))} />
                  <SelectField label={RESERVATION_LABELS.status} value={createForm.status} options={TRANSFER_STATUS_OPTIONS} onChange={(value) => setCreateForm((current) => ({ ...current, status: value }))} />
                </div>
              </FormSection>

              <FormSection title="Notlar">
                <TextArea label={RESERVATION_LABELS.notes} value={createForm.notes} onChange={(value) => setCreateForm((current) => ({ ...current, notes: value }))} />
              </FormSection>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                type="submit"
                disabled={createState.status === "saving"}
              >
                {RESERVATION_LABELS.create}
              </button>
              <span className="text-sm text-slate-500">Kayıt businessId ile izole edilir.</span>
            </div>
          </form>
        ) : null}

        {taskReservationId ? (
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Görev oluştur</div>
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
                      : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {taskState.message}
              </div>
            ) : null}
            <form className="grid gap-3" onSubmit={submitTask}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Başlık" value={taskForm.title} onChange={(value) => setTaskForm((current) => ({ ...current, title: value }))} />
                <Field label="Müşteri" value={taskForm.customerName} onChange={(value) => setTaskForm((current) => ({ ...current, customerName: value }))} />
                <Field label="İlgili rezervasyon" value={taskForm.reservationId} onChange={(value) => setTaskForm((current) => ({ ...current, reservationId: value }))} />
                <Field label="Tarih" type="date" value={taskForm.dueDate} onChange={(value) => setTaskForm((current) => ({ ...current, dueDate: value }))} />
                <Field label="Saat" type="time" value={taskForm.dueTime} onChange={(value) => setTaskForm((current) => ({ ...current, dueTime: value }))} />
                <SelectField label="Öncelik" value={taskForm.priority} options={["Düşük", "Normal", "Yüksek", "Acil"]} onChange={(value) => setTaskForm((current) => ({ ...current, priority: value }))} />
                <SelectField label="Durum" value={taskForm.status} options={["Bekliyor", "Devam Ediyor", "Tamamlandı", "İptal"]} onChange={(value) => setTaskForm((current) => ({ ...current, status: value }))} />
              </div>
              <TextArea label="Açıklama" value={taskForm.description} onChange={(value) => setTaskForm((current) => ({ ...current, description: value }))} />
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

        {whatsAppDraft ? (
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">WhatsApp mesajı hazır</div>
                <h3 className="text-lg font-semibold text-slate-950">Kopyalanabilir önizleme</h3>
              </div>
              <button
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="button"
                onClick={() => void copyWhatsAppDraft()}
              >
                Kopyala
              </button>
            </div>
            <pre className="mt-3 overflow-auto rounded-[20px] bg-white p-4 text-sm leading-6 text-slate-700">
              {whatsAppDraft.message}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1800px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <Th>Tarih</Th>
              <Th>Saat</Th>
              <Th>Müşteri</Th>
              <Th>Nereden → Nereye</Th>
              <Th>Pax</Th>
              <Th>Araç / Şoför</Th>
              <Th>Tedarikçi</Th>
              <Th>Acente / Kaynak</Th>
              <Th>Alınan</Th>
              <Th>Acente PASS</Th>
              <Th>Tedarikçi PASS</Th>
              <Th>Kâr</Th>
              <Th>Transfer durumu</Th>
              <Th>Ödeme durumu</Th>
              <Th>Aksiyonlar</Th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.length ? (
              filteredReservations.map((reservation) => {
                const isEditing = editingId === reservation.id;
                const draft = editForms[reservation.id] ?? createUpdateState(reservation);
                const total = Number(reservation.totalAmount ?? 0);
                const deposit = Number(reservation.depositAmount ?? 0);
                const remaining = Number(reservation.remainingAmount ?? 0);
                const profit = Number.isFinite(total) ? total - remaining : 0;

                return (
                  <Fragment key={reservation.id}>
                    <tr className="border-t border-slate-200 hover:bg-slate-50/60">
                      <Td>{text(reservation.travelDate)}</Td>
                      <Td>{text(reservation.travelTime)}</Td>
                      <Td>
                        <div className="grid gap-1">
                          <div className="font-semibold text-slate-950">{reservation.customerName}</div>
                          <div className="text-xs text-slate-500">{text(reservation.phone)}</div>
                        </div>
                      </Td>
                      <Td>
                        <div className="grid gap-1">
                          <div className="font-medium text-slate-900">{reservationRoute(reservation)}</div>
                          <div className="text-xs text-slate-500">{text(reservation.flightCode)}</div>
                        </div>
                      </Td>
                      <Td>{reservationPax(reservation)}</Td>
                      <Td>
                        <div className="grid gap-1">
                          <div className="font-medium text-slate-900">{text(reservation.vehicleName || reservation.assignedVehicle)}</div>
                          <div className="text-xs text-slate-500">{text(reservation.driverName)}</div>
                        </div>
                      </Td>
                      <Td>{text(reservation.vehicleCategory)}</Td>
                      <Td>
                        <div className="grid gap-1">
                          <div>{text(reservation.source)}</div>
                          <div className="text-xs text-slate-500">{text(reservation.country)}</div>
                        </div>
                      </Td>
                      <Td>{formatMoney(deposit || total, reservation.currency)}</Td>
                      <Td>{formatMoney(deposit, reservation.currency)}</Td>
                      <Td>{formatMoney(remaining, reservation.currency)}</Td>
                      <Td>{formatMoney(profit, reservation.currency)}</Td>
                      <Td>
                        <InlineSelect
                          ariaLabel="Transfer durumu"
                          value={draft.bookingStatus}
                          options={TRANSFER_STATUS_OPTIONS}
                          onChange={(value) => void quickUpdate(reservation.id, "bookingStatus", value)}
                        />
                      </Td>
                      <Td>
                        <InlineSelect
                          ariaLabel="Ödeme durumu"
                          value={draft.paymentStatus}
                          options={RESERVATION_PAYMENT_STATUS_OPTIONS}
                          onChange={(value) => void quickUpdate(reservation.id, "paymentStatus", value)}
                        />
                      </Td>
                      <Td>
                        <div className="flex flex-wrap items-center gap-1">
                          <ActionIcon
                            label="WhatsApp mesajı hazırla"
                            title="WhatsApp mesajı hazırla"
                            onClick={() => prepareWhatsApp(reservation)}
                          >
                            💬
                          </ActionIcon>
                          <ActionIcon
                            label="Voucher / bilet oluştur"
                            title="Voucher / bilet oluştur"
                            onClick={() => router.push(`/app/reservations/${reservation.id}/voucher`)}
                          >
                            🎫
                          </ActionIcon>
                          <ActionIcon
                            label="PDF / yazdır"
                            title="PDF / yazdır"
                            onClick={() => window.print()}
                          >
                            📄
                          </ActionIcon>
                          <ActionIcon
                            label="Hızlı düzenle"
                            title="Hızlı düzenle"
                            onClick={() =>
                              isEditing && editingMode === "quick"
                                ? setEditingId(null)
                                : startEdit(reservation, "quick")
                            }
                          >
                            ⚡
                          </ActionIcon>
                          <ActionIcon
                            label="Düzenle"
                            title="Düzenle"
                            onClick={() =>
                              isEditing && editingMode === "full"
                                ? setEditingId(null)
                                : startEdit(reservation, "full")
                            }
                          >
                            ✎
                          </ActionIcon>
                          <ActionIcon
                            label="Görev oluştur"
                            title="Görev oluştur"
                            onClick={() => openTaskForm(reservation)}
                          >
                            +
                          </ActionIcon>
                          <ActionIcon
                            label="Sil"
                            title="Sil"
                            onClick={() => void deleteReservation(reservation.id)}
                          >
                            🗑
                          </ActionIcon>
                        </div>
                      </Td>
                    </tr>
                    {isEditing ? (
                      <tr className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={15} className="p-4">
                          <div className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                  {editingMode === "quick" ? "Hızlı düzenleme" : "Tam düzenleme"}
                                </div>
                                <h3 className="text-lg font-semibold text-slate-950">{reservation.customerName}</h3>
                              </div>
                              <button
                                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                                type="button"
                                onClick={() => setEditingId(null)}
                              >
                                Kapat
                              </button>
                            </div>

                            {editingMode === "quick" ? (
                              <div className="grid gap-3 md:grid-cols-2">
                                <SelectField
                                  label="Transfer durumu"
                                  value={draft.bookingStatus}
                                  options={TRANSFER_STATUS_OPTIONS}
                                  onChange={(value) =>
                                    setEditForms((current) => ({
                                      ...current,
                                      [reservation.id]: { ...draft, bookingStatus: value },
                                    }))
                                  }
                                />
                                <SelectField
                                  label="Ödeme durumu"
                                  value={draft.paymentStatus}
                                  options={RESERVATION_PAYMENT_STATUS_OPTIONS}
                                  onChange={(value) =>
                                    setEditForms((current) => ({
                                      ...current,
                                      [reservation.id]: { ...draft, paymentStatus: value },
                                    }))
                                  }
                                />
                              </div>
                            ) : (
                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <SelectField
                                  label="Transfer durumu"
                                  value={draft.bookingStatus}
                                  options={TRANSFER_STATUS_OPTIONS}
                                  onChange={(value) =>
                                    setEditForms((current) => ({
                                      ...current,
                                      [reservation.id]: { ...draft, bookingStatus: value },
                                    }))
                                  }
                                />
                                <SelectField
                                  label="Ödeme durumu"
                                  value={draft.paymentStatus}
                                  options={RESERVATION_PAYMENT_STATUS_OPTIONS}
                                  onChange={(value) =>
                                    setEditForms((current) => ({
                                      ...current,
                                      [reservation.id]: { ...draft, paymentStatus: value },
                                    }))
                                  }
                                />
                                <Field
                                  label="Araç kategorisi"
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
                                  value={draft.pickupStatus}
                                  onChange={(value) =>
                                    setEditForms((current) => ({
                                      ...current,
                                      [reservation.id]: { ...draft, pickupStatus: value },
                                    }))
                                  }
                                />
                                <TextArea
                                  label="Operasyon notu"
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
                                  value={draft.notes}
                                  onChange={(value) =>
                                    setEditForms((current) => ({
                                      ...current,
                                      [reservation.id]: { ...draft, notes: value },
                                    }))
                                  }
                                />
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2">
                              <button
                                className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                                type="button"
                                onClick={() => void submitUpdate(reservation.id)}
                              >
                                Kaydet
                              </button>
                              <button
                                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                type="button"
                                onClick={() => setEditingId(null)}
                              >
                                Vazgeç
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-sm text-slate-500">
                  Henüz rezervasyon yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  error,
}: {
  label: string;
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
  value,
  options,
  onChange,
  optionLabels,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  optionLabels?: Record<string, string>;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 outline-none transition focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabels?.[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InlineSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <select
      aria-label={ariaLabel}
      className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
        {title}
      </div>
      {children}
    </section>
  );
}

function Th({ children }: { children: string }) {
  return <th className="px-4 py-4 font-semibold">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-4 align-top">{children}</td>;
}

function ActionIcon({
  label,
  title,
  onClick,
  children,
}: {
  label: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      type="button"
      title={title}
      aria-label={label}
      onClick={onClick}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}
