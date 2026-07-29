"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  DriverRecord,
  OperationBoardStatus,
  OperationReservationRecord,
  OperationsBoardData,
  ReservationAssignmentRecord,
  VehicleRecord,
} from "@/lib/operation-types";

type Props = {
  scope: "business" | "super-admin";
  businessName?: string;
  initialData: OperationsBoardData;
};

type SaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type DriverFormState = {
  name: string;
  phone: string;
  email: string;
  active: boolean;
  notes: string;
};

type VehicleFormState = {
  plate: string;
  brand: string;
  model: string;
  capacity: string;
  active: boolean;
};

type AssignmentDraft = {
  driverId: string;
  vehicleId: string;
  pickupTime: string;
  meetingPoint: string;
};

const BOARD_STATUSES: OperationBoardStatus[] = [
  "Pending",
  "Confirmed",
  "Assigned",
  "In Progress",
  "Completed",
];

function emptyDriverForm(): DriverFormState {
  return {
    name: "",
    phone: "",
    email: "",
    active: true,
    notes: "",
  };
}

function emptyVehicleForm(): VehicleFormState {
  return {
    plate: "",
    brand: "",
    model: "",
    capacity: "0",
    active: true,
  };
}

function buildAssignmentDrafts(data: OperationsBoardData) {
  const map: Record<string, AssignmentDraft> = {};

  for (const reservation of data.reservations) {
    const assignment = data.assignments.find((item) => item.reservationId === reservation.id);
    map[reservation.id] = {
      driverId: assignment?.driverId ?? "",
      vehicleId: assignment?.vehicleId ?? "",
      pickupTime: assignment?.pickupTime ?? reservation.pickupTime ?? "",
      meetingPoint: assignment?.meetingPoint ?? reservation.meetingPoint ?? "",
    };
  }

  return map;
}

function formatDateTime(date: string | null | undefined, time: string | null | undefined) {
  const parts = [date, time].map((value) => String(value ?? "").trim()).filter(Boolean);
  return parts.length ? parts.join(" ") : "-";
}

function formatRoute(reservation: OperationReservationRecord) {
  return `${reservation.origin ?? "-"} → ${reservation.destination ?? "-"}`;
}

function formatMoney(value: number | null | undefined, currency: string | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return `${new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency ?? "TRY"}`;
}

async function readJson(response: Response) {
  const text = await response.text().catch(() => "");

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export function OperationsModule({ scope, businessName, initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle", message: "" });
  const [draggedReservationId, setDraggedReservationId] = useState<string | null>(null);
  const [driverForm, setDriverForm] = useState<DriverFormState>(emptyDriverForm());
  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(emptyVehicleForm());
  const [driverEditForms, setDriverEditForms] = useState<Record<string, DriverFormState>>({});
  const [vehicleEditForms, setVehicleEditForms] = useState<Record<string, VehicleFormState>>({});
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>(
    buildAssignmentDrafts(initialData),
  );

  useEffect(() => {
    setData(initialData);
    setAssignmentDrafts(buildAssignmentDrafts(initialData));
  }, [initialData]);

  const boardColumns = useMemo(
    () => BOARD_STATUSES.map((status) => ({
      status,
      items: data.reservations.filter((reservation) => reservation.operationStatus === status),
    })),
    [data.reservations],
  );

  async function refreshBoard() {
    const endpoint =
      scope === "super-admin" ? "/api/super-admin/operations" : "/api/business/operations";
    const response = await fetch(endpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return;
    }

    const body = (await readJson(response)) as { board?: OperationsBoardData } | null;
    if (body?.board) {
      setData(body.board);
      setAssignmentDrafts(buildAssignmentDrafts(body.board));
    }
  }

  async function submitDriver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (scope !== "business") {
      return;
    }

    setSaveState({ status: "saving", message: "Driver kaydediliyor..." });

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/business/drivers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
        active: formData.get("active") === "on",
        notes: String(formData.get("notes") ?? ""),
      }),
    });

    const body = await readJson(response);

    if (!response.ok) {
      setSaveState({
        status: "error",
        message:
          typeof body === "object" && body && "message" in body
            ? String((body as { message?: string }).message ?? "Driver kaydedilemedi.")
            : "Driver kaydedilemedi.",
      });
      return;
    }

    setDriverForm(emptyDriverForm());
    event.currentTarget.reset();
    await refreshBoard();
    setSaveState({ status: "success", message: "Driver kaydedildi." });
  }

  async function submitVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (scope !== "business") {
      return;
    }

    setSaveState({ status: "saving", message: "Vehicle kaydediliyor..." });

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/business/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        plate: String(formData.get("plate") ?? ""),
        brand: String(formData.get("brand") ?? ""),
        model: String(formData.get("model") ?? ""),
        capacity: Number(formData.get("capacity") ?? 0),
        active: formData.get("active") === "on",
      }),
    });

    const body = await readJson(response);

    if (!response.ok) {
      setSaveState({
        status: "error",
        message:
          typeof body === "object" && body && "message" in body
            ? String((body as { message?: string }).message ?? "Vehicle kaydedilemedi.")
            : "Vehicle kaydedilemedi.",
      });
      return;
    }

    setVehicleForm(emptyVehicleForm());
    event.currentTarget.reset();
    await refreshBoard();
    setSaveState({ status: "success", message: "Vehicle kaydedildi." });
  }

  async function updateDriver(driverId: string, form: DriverFormState) {
    if (scope !== "business") {
      return;
    }

    setSaveState({ status: "saving", message: "Driver güncelleniyor..." });
    const response = await fetch(`/api/business/drivers/${driverId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        email: form.email,
        active: form.active,
        notes: form.notes,
      }),
    });

    const body = await readJson(response);
    if (!response.ok) {
      setSaveState({
        status: "error",
        message:
          typeof body === "object" && body && "message" in body
            ? String((body as { message?: string }).message ?? "Driver güncellenemedi.")
            : "Driver güncellenemedi.",
      });
      return;
    }

    await refreshBoard();
    setSaveState({ status: "success", message: "Driver güncellendi." });
  }

  async function updateVehicle(vehicleId: string, form: VehicleFormState) {
    if (scope !== "business") {
      return;
    }

    setSaveState({ status: "saving", message: "Vehicle güncelleniyor..." });
    const response = await fetch(`/api/business/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        plate: form.plate,
        brand: form.brand,
        model: form.model,
        capacity: Number(form.capacity),
        active: form.active,
      }),
    });

    const body = await readJson(response);
    if (!response.ok) {
      setSaveState({
        status: "error",
        message:
          typeof body === "object" && body && "message" in body
            ? String((body as { message?: string }).message ?? "Vehicle güncellenemedi.")
            : "Vehicle güncellenemedi.",
      });
      return;
    }

    await refreshBoard();
    setSaveState({ status: "success", message: "Vehicle güncellendi." });
  }

  async function removeDriver(driverId: string) {
    if (scope !== "business") {
      return;
    }

    await fetch(`/api/business/drivers/${driverId}`, { method: "DELETE" });
    await refreshBoard();
  }

  async function removeVehicle(vehicleId: string) {
    if (scope !== "business") {
      return;
    }

    await fetch(`/api/business/vehicles/${vehicleId}`, { method: "DELETE" });
    await refreshBoard();
  }

  async function updateStatus(reservationId: string, operationStatus: OperationBoardStatus) {
    if (scope !== "business") {
      return;
    }

    setSaveState({ status: "saving", message: "Operasyon durumu güncelleniyor..." });
    const response = await fetch(`/api/business/operations/${reservationId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ operationStatus }),
    });

    const body = await readJson(response);
    if (!response.ok) {
      setSaveState({
        status: "error",
        message:
          typeof body === "object" && body && "message" in body
            ? String((body as { message?: string }).message ?? "Durum güncellenemedi.")
            : "Durum güncellenemedi.",
      });
      return;
    }

    await refreshBoard();
    setSaveState({ status: "success", message: "Operasyon durumu güncellendi." });
  }

  async function assignReservation(reservationId: string) {
    if (scope !== "business") {
      return;
    }

    const draft = assignmentDrafts[reservationId] ?? {
      driverId: "",
      vehicleId: "",
      pickupTime: "",
      meetingPoint: "",
    };

    setSaveState({ status: "saving", message: "Atama kaydediliyor..." });
    const response = await fetch("/api/business/reservation-assignments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        reservationId,
        driverId: draft.driverId,
        vehicleId: draft.vehicleId,
        pickupTime: draft.pickupTime,
        meetingPoint: draft.meetingPoint,
      }),
    });

    const body = await readJson(response);
    if (!response.ok) {
      setSaveState({
        status: "error",
        message:
          typeof body === "object" && body && "message" in body
            ? String((body as { message?: string }).message ?? "Atama kaydedilemedi.")
            : "Atama kaydedilemedi.",
      });
      return;
    }

    await refreshBoard();
    setSaveState({ status: "success", message: "Atama kaydedildi." });
  }

  const title = scope === "super-admin" ? "Operations Dashboard - All Tenants" : businessName ?? "Operations Dashboard";

  return (
    <section className="grid gap-6">
      <article className="rounded-[32px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_60%,#eff6ff_100%)] p-6 shadow-sm lg:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Dispatch & Operations Engine
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 lg:text-5xl">
              {title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              Ödeme alınan rezervasyonların operasyon ekibince yönetildiği merkezi kontrol alanı.
            </p>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-4 text-sm text-slate-600 shadow-sm backdrop-blur">
            <div className="font-medium text-slate-950">
              {scope === "super-admin" ? "All tenants" : businessName ?? "Business"}
            </div>
            <div className="mt-1">Reservations: {data.reservations.length}</div>
            <div>Drivers: {data.drivers.length}</div>
            <div>Vehicles: {data.vehicles.length}</div>
          </div>
        </div>
      </article>

      {saveState.message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            saveState.status === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {saveState.message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Today's Transfers" value={String(data.summary.todayTransfers)} />
        <StatCard label="Drivers Available" value={String(data.summary.driversAvailable)} />
        <StatCard label="Vehicles Available" value={String(data.summary.vehiclesAvailable)} />
        <StatCard label="Waiting Assignment" value={String(data.summary.waitingAssignments)} />
        <StatCard label="Active Transfers" value={String(data.summary.activeTransfers)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Pending" value={String(data.summary.pendingReservations)} />
        <StatCard label="Confirmed" value={String(data.summary.confirmedReservations)} />
        <StatCard label="Completed" value={String(data.summary.completedTransfers)} />
        <StatCard label="Cancelled" value={String(data.summary.cancelledTransfers)} />
        <StatCard label="No Show" value={String(data.summary.noShowTransfers)} />
        <StatCard label="Board Cards" value={String(data.columns.reduce((sum, column) => sum + column.items.length, 0))} />
      </div>

      <section className="grid gap-6">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Operations Board</h2>
              <p className="mt-1 text-sm text-slate-600">
                Kartları sürükleyip statü kolonları arasında taşıyabilirsin.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-5">
            {data.columns.map((column) => (
              <div
                key={column.status}
                className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const reservationId = event.dataTransfer.getData("text/plain");
                  if (reservationId) {
                    void updateStatus(reservationId, column.status);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {column.status}
                  </h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {column.items.length}
                  </span>
                </div>
                <div className="mt-4 grid gap-3">
                  {column.items.map((reservation) => (
                    <article
                      key={reservation.id}
                      draggable={scope === "business"}
                      onDragStart={(event) => {
                        setDraggedReservationId(reservation.id);
                        event.dataTransfer.setData("text/plain", reservation.id);
                      }}
                      onDragEnd={() => setDraggedReservationId(null)}
                      className={`grid gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm ${
                        draggedReservationId === reservation.id ? "opacity-70" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="grid gap-1">
                          <div className="font-semibold text-slate-950">{reservation.customerName}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            {formatRoute(reservation)}
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                          {reservation.operationStatus}
                        </span>
                      </div>

                      <div className="grid gap-1 text-sm text-slate-600">
                        <div>{formatDateTime(reservation.travelDate, reservation.travelTime)}</div>
                        <div>Flight: {reservation.flightCode ?? "-"}</div>
                        <div>Driver: {reservation.driverName ?? "-"}</div>
                        <div>Vehicle: {reservation.assignedVehicle ?? reservation.vehicleName ?? "-"}</div>
                        <div>Pickup: {reservation.pickupTime ?? "-"}</div>
                        <div>Meeting: {reservation.meetingPoint ?? "-"}</div>
                        <div>Amount: {formatMoney(reservation.totalAmount, reservation.currency)}</div>
                      </div>

                      {scope === "business" ? (
                        <div className="grid gap-2 rounded-[18px] border border-slate-200 bg-slate-50 p-3">
                          <select
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                            value={assignmentDrafts[reservation.id]?.driverId ?? ""}
                            onChange={(event) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [reservation.id]: {
                                  ...(current[reservation.id] ?? {
                                    driverId: "",
                                    vehicleId: "",
                                    pickupTime: "",
                                    meetingPoint: "",
                                  }),
                                  driverId: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Driver seç</option>
                            {data.drivers.map((driver) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.name}
                              </option>
                            ))}
                          </select>

                          <select
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                            value={assignmentDrafts[reservation.id]?.vehicleId ?? ""}
                            onChange={(event) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [reservation.id]: {
                                  ...(current[reservation.id] ?? {
                                    driverId: "",
                                    vehicleId: "",
                                    pickupTime: "",
                                    meetingPoint: "",
                                  }),
                                  vehicleId: event.target.value,
                                },
                              }))
                            }
                          >
                            <option value="">Vehicle seç</option>
                            {data.vehicles.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicle.plate} - {vehicle.brand} {vehicle.model}
                              </option>
                            ))}
                          </select>

                          <input
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                            placeholder="Pickup time"
                            value={assignmentDrafts[reservation.id]?.pickupTime ?? ""}
                            onChange={(event) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [reservation.id]: {
                                  ...(current[reservation.id] ?? {
                                    driverId: "",
                                    vehicleId: "",
                                    pickupTime: "",
                                    meetingPoint: "",
                                  }),
                                  pickupTime: event.target.value,
                                },
                              }))
                            }
                          />

                          <input
                            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                            placeholder="Meeting point"
                            value={assignmentDrafts[reservation.id]?.meetingPoint ?? ""}
                            onChange={(event) =>
                              setAssignmentDrafts((current) => ({
                                ...current,
                                [reservation.id]: {
                                  ...(current[reservation.id] ?? {
                                    driverId: "",
                                    vehicleId: "",
                                    pickupTime: "",
                                    meetingPoint: "",
                                  }),
                                  meetingPoint: event.target.value,
                                },
                              }))
                            }
                          />

                          <div className="flex flex-wrap gap-2">
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-xs font-semibold text-white"
                              type="button"
                              onClick={() => void assignReservation(reservation.id)}
                            >
                              Assign
                            </button>
                            <button
                              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                              type="button"
                              onClick={() => void updateStatus(reservation.id, column.status)}
                            >
                              Set {column.status}
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>

        {scope === "business" ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Drivers</h2>
              <p className="mt-1 text-sm text-slate-600">Tenant driver CRUD.</p>

              <form className="mt-4 grid gap-3" onSubmit={submitDriver}>
                <input
                  name="name"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                  placeholder="Driver name"
                  value={driverForm.name}
                  onChange={(event) => setDriverForm((current) => ({ ...current, name: event.target.value }))}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    name="phone"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                    placeholder="Phone"
                    value={driverForm.phone}
                    onChange={(event) => setDriverForm((current) => ({ ...current, phone: event.target.value }))}
                  />
                  <input
                    name="email"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                    placeholder="Email"
                    value={driverForm.email}
                    onChange={(event) => setDriverForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </div>
                <textarea
                  name="notes"
                  className="min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Notes"
                  value={driverForm.notes}
                  onChange={(event) => setDriverForm((current) => ({ ...current, notes: event.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    name="active"
                    type="checkbox"
                    checked={driverForm.active}
                    onChange={(event) => setDriverForm((current) => ({ ...current, active: event.target.checked }))}
                  />
                  Active
                </label>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  Save driver
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {data.drivers.map((driver) => {
                  const form = driverEditForms[driver.id] ?? {
                    name: driver.name,
                    phone: driver.phone,
                    email: driver.email,
                    active: driver.active,
                    notes: driver.notes ?? "",
                  };

                  return (
                    <article key={driver.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{driver.name}</div>
                            <div className="text-sm text-slate-600">{driver.phone} / {driver.email}</div>
                          </div>
                          <button
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                            type="button"
                            onClick={() => void removeDriver(driver.id)}
                          >
                            Delete
                          </button>
                        </div>
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-slate-700">
                            Edit
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <input
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                              value={form.name}
                              onChange={(event) =>
                                setDriverEditForms((current) => ({
                                  ...current,
                                  [driver.id]: { ...form, name: event.target.value },
                                }))
                              }
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <input
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                                value={form.phone}
                                onChange={(event) =>
                                  setDriverEditForms((current) => ({
                                    ...current,
                                    [driver.id]: { ...form, phone: event.target.value },
                                  }))
                                }
                              />
                              <input
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                                value={form.email}
                                onChange={(event) =>
                                  setDriverEditForms((current) => ({
                                    ...current,
                                    [driver.id]: { ...form, email: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <textarea
                              className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                              value={form.notes}
                              onChange={(event) =>
                                setDriverEditForms((current) => ({
                                  ...current,
                                  [driver.id]: { ...form, notes: event.target.value },
                                }))
                              }
                            />
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(event) =>
                                  setDriverEditForms((current) => ({
                                    ...current,
                                    [driver.id]: { ...form, active: event.target.checked },
                                  }))
                                }
                              />
                              Active
                            </label>
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
                              type="button"
                              onClick={() => void updateDriver(driver.id, form)}
                            >
                              Update
                            </button>
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight text-slate-950">Vehicles</h2>
              <p className="mt-1 text-sm text-slate-600">Tenant vehicle CRUD.</p>

              <form className="mt-4 grid gap-3" onSubmit={submitVehicle}>
                <input
                  name="plate"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                  placeholder="Plate"
                  value={vehicleForm.plate}
                  onChange={(event) => setVehicleForm((current) => ({ ...current, plate: event.target.value }))}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    name="brand"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                    placeholder="Brand"
                    value={vehicleForm.brand}
                    onChange={(event) => setVehicleForm((current) => ({ ...current, brand: event.target.value }))}
                  />
                  <input
                    name="model"
                    className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                    placeholder="Model"
                    value={vehicleForm.model}
                    onChange={(event) => setVehicleForm((current) => ({ ...current, model: event.target.value }))}
                  />
                </div>
                <input
                  name="capacity"
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none"
                  placeholder="Capacity"
                  inputMode="numeric"
                  value={vehicleForm.capacity}
                  onChange={(event) => setVehicleForm((current) => ({ ...current, capacity: event.target.value }))}
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    name="active"
                    type="checkbox"
                    checked={vehicleForm.active}
                    onChange={(event) => setVehicleForm((current) => ({ ...current, active: event.target.checked }))}
                  />
                  Active
                </label>
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white"
                  type="submit"
                >
                  Save vehicle
                </button>
              </form>

              <div className="mt-5 grid gap-3">
                {data.vehicles.map((vehicle) => {
                  const form = vehicleEditForms[vehicle.id] ?? {
                    plate: vehicle.plate,
                    brand: vehicle.brand,
                    model: vehicle.model,
                    capacity: String(vehicle.capacity),
                    active: vehicle.active,
                  };

                  return (
                    <article key={vehicle.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-950">{vehicle.plate}</div>
                            <div className="text-sm text-slate-600">
                              {vehicle.brand} {vehicle.model} · {vehicle.capacity} pax
                            </div>
                          </div>
                          <button
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700"
                            type="button"
                            onClick={() => void removeVehicle(vehicle.id)}
                          >
                            Delete
                          </button>
                        </div>
                        <details>
                          <summary className="cursor-pointer text-sm font-medium text-slate-700">
                            Edit
                          </summary>
                          <div className="mt-3 grid gap-3">
                            <input
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                              value={form.plate}
                              onChange={(event) =>
                                setVehicleEditForms((current) => ({
                                  ...current,
                                  [vehicle.id]: { ...form, plate: event.target.value },
                                }))
                              }
                            />
                            <div className="grid gap-3 md:grid-cols-2">
                              <input
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                                value={form.brand}
                                onChange={(event) =>
                                  setVehicleEditForms((current) => ({
                                    ...current,
                                    [vehicle.id]: { ...form, brand: event.target.value },
                                  }))
                                }
                              />
                              <input
                                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                                value={form.model}
                                onChange={(event) =>
                                  setVehicleEditForms((current) => ({
                                    ...current,
                                    [vehicle.id]: { ...form, model: event.target.value },
                                  }))
                                }
                              />
                            </div>
                            <input
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                              value={form.capacity}
                              onChange={(event) =>
                                setVehicleEditForms((current) => ({
                                  ...current,
                                  [vehicle.id]: { ...form, capacity: event.target.value },
                                }))
                              }
                            />
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={form.active}
                                onChange={(event) =>
                                  setVehicleEditForms((current) => ({
                                    ...current,
                                    [vehicle.id]: { ...form, active: event.target.checked },
                                  }))
                                }
                              />
                              Active
                            </label>
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white"
                              type="button"
                              onClick={() =>
                                void updateVehicle(vehicle.id, {
                                  ...form,
                                  capacity: String(form.capacity),
                                })
                              }
                            >
                              Update
                            </button>
                          </div>
                        </details>
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
    </article>
  );
}

