import "server-only";

import { randomUUID } from "node:crypto";
import { listBusinesses } from "@/lib/business";
import { getSupabaseConfig, hasSupabaseConnection } from "@/lib/supabase-config";
import {
  OPERATION_BOARD_STATUSES,
  type AssignmentCreateInput,
  type DriverRecord,
  type DriverUpsertInput,
  type OperationBoardStatus,
  type OperationBoardColumn,
  type OperationReservationRecord,
  type OperationsBoardData,
  type OperationsDashboardSummary,
  type ReservationAssignmentRecord,
  type VehicleRecord,
  type VehicleUpsertInput,
} from "@/lib/operation-types";

type DemoState = {
  reservations: OperationReservationRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
  assignments: ReservationAssignmentRecord[];
};

const demoStates = new Map<string, DemoState>([
  [
    "business-demo-1",
    {
      reservations: [
        {
          id: "request-1",
          businessId: "business-demo-1",
          customerName: "Demo User",
          passengerName: "Demo User",
          origin: "Airport",
          destination: "Hotel",
          travelDate: "2026-06-10",
          travelTime: "10:30",
          flightCode: "TK123",
          vehicleCategory: "VIP",
          vehicleName: "VIP Van",
          assignedVehicle: "VIP Van",
          driverName: "Demo Driver",
          pickupTime: "10:15",
          meetingPoint: "Terminal A",
          operationStatus: "Assigned",
          paymentStatus: "Ödendi",
          bookingStatus: "Onaylandı",
          currency: "TRY",
          totalAmount: 1200,
          createdAt: "2026-06-10T10:00:00.000Z",
        },
      ],
      drivers: [
        {
          id: "driver-1",
          businessId: "business-demo-1",
          name: "Demo Driver",
          phone: "+90 555 111 22 33",
          email: "driver@example.com",
          active: true,
          notes: "Demo sürücü",
          createdAt: "2026-06-10T10:00:00.000Z",
          updatedAt: "2026-06-10T10:00:00.000Z",
        },
      ],
      vehicles: [
        {
          id: "vehicle-1",
          businessId: "business-demo-1",
          plate: "07 DEMO 1",
          brand: "Mercedes",
          model: "Vito",
          capacity: 7,
          active: true,
          createdAt: "2026-06-10T10:00:00.000Z",
          updatedAt: "2026-06-10T10:00:00.000Z",
        },
      ],
      assignments: [
        {
          id: "assignment-1",
          businessId: "business-demo-1",
          reservationId: "request-1",
          driverId: "driver-1",
          vehicleId: "vehicle-1",
          assignedAt: "2026-06-10T10:05:00.000Z",
          assignedBy: "demo-admin",
          pickupTime: "10:15",
          meetingPoint: "Terminal A",
          createdAt: "2026-06-10T10:05:00.000Z",
          updatedAt: "2026-06-10T10:05:00.000Z",
        },
      ],
    },
  ],
]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  const safe = String(value ?? "").trim();
  return safe || "";
}

function normalizeOptionalText(value?: string | null) {
  const safe = normalizeText(value);
  return safe || null;
}

function normalizeNumber(value?: number | string | null) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function normalizeOperationStatus(value?: string | null) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "Pending" as const;
  }

  if (OPERATION_BOARD_STATUSES.includes(normalized as OperationBoardStatus)) {
    return normalized as OperationBoardStatus;
  }

  const map: Record<string, OperationBoardStatus> = {
    pending: "Pending",
    confirmed: "Confirmed",
    assigned: "Assigned",
    "driver on the way": "Assigned",
    "passenger picked up": "In Progress",
    "in progress": "In Progress",
    completed: "Completed",
    cancelled: "Completed",
    canceled: "Completed",
    "no show": "Pending",
    no_show: "Pending",
  };

  return map[normalized.toLowerCase()] ?? "Pending";
}

function mapDriver(row: Record<string, unknown>): DriverRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    active: Boolean(row.active ?? true),
    notes: (row.notes as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapVehicle(row: Record<string, unknown>): VehicleRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    plate: String(row.plate ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    capacity: Number(row.capacity ?? 0),
    active: Boolean(row.active ?? true),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapAssignment(row: Record<string, unknown>): ReservationAssignmentRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    reservationId: String(row.reservation_id ?? ""),
    driverId: (row.driver_id as string | null) ?? null,
    vehicleId: (row.vehicle_id as string | null) ?? null,
    assignedAt: String(row.assigned_at ?? ""),
    assignedBy: (row.assigned_by as string | null) ?? null,
    pickupTime: (row.pickup_time as string | null) ?? null,
    meetingPoint: (row.meeting_point as string | null) ?? null,
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapReservation(row: Record<string, unknown>): OperationReservationRecord {
  return {
    id: String(row.id ?? ""),
    businessId: String(row.business_id ?? ""),
    customerName: String(row.customer_name ?? ""),
    passengerName: (row.passenger_name as string | null) ?? null,
    origin: (row.from_location as string | null) ?? null,
    destination: (row.to_location as string | null) ?? null,
    travelDate: (row.travel_date as string | null) ?? null,
    travelTime: (row.travel_time as string | null) ?? null,
    flightCode: (row.flight_code as string | null) ?? null,
    vehicleCategory: (row.vehicle_category as string | null) ?? null,
    vehicleName: (row.vehicle_name as string | null) ?? null,
    assignedVehicle: (row.assigned_vehicle as string | null) ?? null,
    driverName: (row.driver_name as string | null) ?? null,
    pickupTime: (row.pickup_time as string | null) ?? null,
    meetingPoint: (row.meeting_point as string | null) ?? null,
    operationStatus: normalizeOperationStatus(row.operation_status as string | null),
    paymentStatus: String(row.payment_status ?? ""),
    bookingStatus: String(row.booking_status ?? ""),
    currency: (row.currency as string | null) ?? null,
    totalAmount:
      row.total_amount === null || row.total_amount === undefined
        ? null
        : Number(row.total_amount),
    createdAt: String(row.created_at ?? ""),
  };
}

function createDemoState(businessId: string): DemoState {
  return demoStates.get(businessId) ?? {
    reservations: [],
    drivers: [],
    vehicles: [],
    assignments: [],
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}

async function readRows(path: string) {
  const response = await supabaseFetch(path);

  if (!response?.ok) {
    return [];
  }

  return (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
}

async function readErrorMessage(response: Response | null, fallback: string) {
  if (!response) {
    return fallback;
  }

  const body = await response.json().catch(() => null);

  if (body && typeof body === "object") {
    const message = (body as { message?: string; error?: string }).message;
    const error = (body as { error?: string }).error;
    return message ?? error ?? fallback;
  }

  return fallback;
}

function withBusinessFilter(path: string, businessId?: string) {
  if (!businessId) {
    return path;
  }

  const hasQuery = path.includes("?");
  return `${path}${hasQuery ? "&" : "?"}business_id=eq.${encodeURIComponent(businessId)}`;
}

function listGlobalStates() {
  return listBusinesses();
}

function toStateMap(states: Array<{ id: string }>) {
  return states.map((item) => item.id);
}

export async function listOperationReservations(businessId?: string) {
  if (hasSupabaseConnection()) {
    if (businessId) {
      const rows = await readRows(
        `/requests?select=id,business_id,customer_name,passenger_name,from_location,to_location,travel_date,travel_time,flight_code,vehicle_category,vehicle_name,assigned_vehicle,driver_name,pickup_time,meeting_point,operation_status,payment_status,booking_status,currency,total_amount,created_at&business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=created_at.desc`,
      );
      return rows.map(mapReservation);
    }

    const businesses = await listGlobalStates();
    const rows = await Promise.all(
      toStateMap(businesses).map(async (id) =>
        readRows(
          `/requests?select=id,business_id,customer_name,passenger_name,from_location,to_location,travel_date,travel_time,flight_code,vehicle_category,vehicle_name,assigned_vehicle,driver_name,pickup_time,meeting_point,operation_status,payment_status,booking_status,currency,total_amount,created_at&business_id=eq.${encodeURIComponent(
            id,
          )}&order=created_at.desc`,
        ),
      ),
    );

    return rows.flat().map(mapReservation);
  }

  if (businessId) {
    return createDemoState(businessId).reservations.slice();
  }

  return Array.from(demoStates.values()).flatMap((state) => state.reservations.slice());
}

export async function listDrivers(businessId?: string) {
  if (hasSupabaseConnection()) {
    if (businessId) {
      const rows = await readRows(
        `/drivers?select=id,business_id,name,phone,email,active,notes,created_at,updated_at&business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=created_at.desc`,
      );
      return rows.map(mapDriver);
    }

    const businesses = await listGlobalStates();
    const rows = await Promise.all(
      toStateMap(businesses).map(async (id) =>
        readRows(
          `/drivers?select=id,business_id,name,phone,email,active,notes,created_at,updated_at&business_id=eq.${encodeURIComponent(
            id,
          )}&order=created_at.desc`,
        ),
      ),
    );

    return rows.flat().map(mapDriver);
  }

  if (businessId) {
    return createDemoState(businessId).drivers.slice();
  }

  return Array.from(demoStates.values()).flatMap((state) => state.drivers.slice());
}

export async function listVehicles(businessId?: string) {
  if (hasSupabaseConnection()) {
    if (businessId) {
      const rows = await readRows(
        `/vehicles?select=id,business_id,plate,brand,model,capacity,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=created_at.desc`,
      );
      return rows.map(mapVehicle);
    }

    const businesses = await listGlobalStates();
    const rows = await Promise.all(
      toStateMap(businesses).map(async (id) =>
        readRows(
          `/vehicles?select=id,business_id,plate,brand,model,capacity,active,created_at,updated_at&business_id=eq.${encodeURIComponent(
            id,
          )}&order=created_at.desc`,
        ),
      ),
    );

    return rows.flat().map(mapVehicle);
  }

  if (businessId) {
    return createDemoState(businessId).vehicles.slice();
  }

  return Array.from(demoStates.values()).flatMap((state) => state.vehicles.slice());
}

export async function listAssignments(businessId?: string) {
  if (hasSupabaseConnection()) {
    if (businessId) {
      const rows = await readRows(
        `/reservation_assignments?select=id,business_id,reservation_id,driver_id,vehicle_id,assigned_at,assigned_by,pickup_time,meeting_point,created_at,updated_at&business_id=eq.${encodeURIComponent(
          businessId,
        )}&order=assigned_at.desc`,
      );
      return rows.map(mapAssignment);
    }

    const businesses = await listGlobalStates();
    const rows = await Promise.all(
      toStateMap(businesses).map(async (id) =>
        readRows(
          `/reservation_assignments?select=id,business_id,reservation_id,driver_id,vehicle_id,assigned_at,assigned_by,pickup_time,meeting_point,created_at,updated_at&business_id=eq.${encodeURIComponent(
            id,
          )}&order=assigned_at.desc`,
        ),
      ),
    );

    return rows.flat().map(mapAssignment);
  }

  if (businessId) {
    return createDemoState(businessId).assignments.slice();
  }

  return Array.from(demoStates.values()).flatMap((state) => state.assignments.slice());
}

export function getOperationSummary(
  reservations: OperationReservationRecord[],
  drivers: DriverRecord[],
  vehicles: VehicleRecord[],
): OperationsDashboardSummary {
  const todayKey = new Date().toISOString().slice(0, 10);
  const activeStatuses = new Set<OperationBoardStatus>([
    "Assigned",
    "In Progress",
  ]);

  const summary = reservations.reduce<OperationsDashboardSummary>(
    (accumulator, reservation) => {
      if (reservation.travelDate === todayKey) {
        accumulator.todayTransfers += 1;
      }

      if (reservation.operationStatus === "Pending") {
        accumulator.pendingReservations += 1;
      }

      if (reservation.operationStatus === "Confirmed") {
        accumulator.confirmedReservations += 1;
        accumulator.waitingAssignments += 1;
      }

      if (activeStatuses.has(reservation.operationStatus as OperationBoardStatus)) {
        accumulator.activeTransfers += 1;
      }

      if (reservation.operationStatus === "Completed") {
        accumulator.completedTransfers += 1;
      }

      if (reservation.operationStatus === "Cancelled") {
        accumulator.cancelledTransfers += 1;
      }

      if (reservation.operationStatus === "No Show") {
        accumulator.noShowTransfers += 1;
      }

      return accumulator;
    },
    {
      todayTransfers: 0,
      pendingReservations: 0,
      confirmedReservations: 0,
      waitingAssignments: 0,
      activeTransfers: 0,
      completedTransfers: 0,
      cancelledTransfers: 0,
      noShowTransfers: 0,
      driversAvailable: drivers.filter((item) => item.active).length,
      vehiclesAvailable: vehicles.filter((item) => item.active).length,
    },
  );

  return summary;
}

export async function getOperationsBoardData(businessId?: string) {
  const [reservations, drivers, vehicles, assignments] = await Promise.all([
    listOperationReservations(businessId),
    listDrivers(businessId),
    listVehicles(businessId),
    listAssignments(businessId),
  ]);

  const summary = getOperationSummary(reservations, drivers, vehicles);
  const columns = OPERATION_BOARD_STATUSES.map<OperationBoardColumn>((status) => ({
    status,
    title: status,
    items: reservations.filter((item) => item.operationStatus === status),
  }));

  return {
    reservations,
    drivers,
    vehicles,
    assignments,
    summary,
    columns,
  } satisfies OperationsBoardData;
}

async function writeSupabaseRecord(path: string, payload: Record<string, unknown>, method: "POST" | "PATCH") {
  const response = await supabaseFetch(path, {
    method,
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  if (!response?.ok) {
    throw new Error(await readErrorMessage(response, "Operation failed."));
  }

  const rows = (await response.json().catch(() => [])) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export async function listDriversByBusiness(businessId?: string) {
  return listDrivers(businessId);
}

export async function listVehiclesByBusiness(businessId?: string) {
  return listVehicles(businessId);
}

export async function createDriver(input: DriverUpsertInput) {
  const payload = {
    business_id: input.businessId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    active: input.active,
    notes: input.notes ?? null,
  };

  if (hasSupabaseConnection()) {
    const row = await writeSupabaseRecord(`/drivers`, payload, "POST");
    return row ? mapDriver(row) : null;
  }

  const record: DriverRecord = {
    id: `driver-${randomUUID()}`,
    businessId: input.businessId,
    name: input.name,
    phone: input.phone,
    email: input.email,
    active: input.active,
    notes: input.notes ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const state = createDemoState(input.businessId);
  state.drivers = [record, ...state.drivers.filter((item) => item.id !== record.id)];
  demoStates.set(input.businessId, state);
  return record;
}

export async function updateDriver(input: DriverUpsertInput & { driverId: string }) {
  const payload = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    active: input.active,
    notes: input.notes ?? null,
  };

  if (hasSupabaseConnection()) {
    const row = await writeSupabaseRecord(
      `/drivers?id=eq.${encodeURIComponent(input.driverId)}&business_id=eq.${encodeURIComponent(
        input.businessId,
      )}`,
      payload,
      "PATCH",
    );
    return row ? mapDriver(row) : null;
  }

  const state = createDemoState(input.businessId);
  const existing = state.drivers.find((item) => item.id === input.driverId);

  if (!existing) {
    throw new Error("Driver not found.");
  }

  const updated: DriverRecord = {
    ...existing,
    name: input.name,
    phone: input.phone,
    email: input.email,
    active: input.active,
    notes: input.notes ?? null,
    updatedAt: nowIso(),
  };

  state.drivers = state.drivers.map((item) => (item.id === input.driverId ? updated : item));
  demoStates.set(input.businessId, state);
  return updated;
}

export async function deleteDriver(businessId: string, driverId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/drivers?id=eq.${encodeURIComponent(driverId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Driver could not be deleted.");
    }

    return true;
  }

  const state = createDemoState(businessId);
  state.drivers = state.drivers.filter((item) => item.id !== driverId);
  demoStates.set(businessId, state);
  return true;
}

export async function createVehicle(input: VehicleUpsertInput) {
  const payload = {
    business_id: input.businessId,
    plate: input.plate,
    brand: input.brand,
    model: input.model,
    capacity: input.capacity,
    active: input.active,
  };

  if (hasSupabaseConnection()) {
    const row = await writeSupabaseRecord(`/vehicles`, payload, "POST");
    return row ? mapVehicle(row) : null;
  }

  const record: VehicleRecord = {
    id: `vehicle-${randomUUID()}`,
    businessId: input.businessId,
    plate: input.plate,
    brand: input.brand,
    model: input.model,
    capacity: input.capacity,
    active: input.active,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const state = createDemoState(input.businessId);
  state.vehicles = [record, ...state.vehicles.filter((item) => item.id !== record.id)];
  demoStates.set(input.businessId, state);
  return record;
}

export async function updateVehicle(input: VehicleUpsertInput & { vehicleId: string }) {
  const payload = {
    plate: input.plate,
    brand: input.brand,
    model: input.model,
    capacity: input.capacity,
    active: input.active,
  };

  if (hasSupabaseConnection()) {
    const row = await writeSupabaseRecord(
      `/vehicles?id=eq.${encodeURIComponent(input.vehicleId)}&business_id=eq.${encodeURIComponent(
        input.businessId,
      )}`,
      payload,
      "PATCH",
    );
    return row ? mapVehicle(row) : null;
  }

  const state = createDemoState(input.businessId);
  const existing = state.vehicles.find((item) => item.id === input.vehicleId);

  if (!existing) {
    throw new Error("Vehicle not found.");
  }

  const updated: VehicleRecord = {
    ...existing,
    plate: input.plate,
    brand: input.brand,
    model: input.model,
    capacity: input.capacity,
    active: input.active,
    updatedAt: nowIso(),
  };

  state.vehicles = state.vehicles.map((item) => (item.id === input.vehicleId ? updated : item));
  demoStates.set(input.businessId, state);
  return updated;
}

export async function deleteVehicle(businessId: string, vehicleId: string) {
  if (hasSupabaseConnection()) {
    const response = await supabaseFetch(
      `/vehicles?id=eq.${encodeURIComponent(vehicleId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        method: "DELETE",
      },
    );

    if (!response?.ok) {
      throw new Error("Vehicle could not be deleted.");
    }

    return true;
  }

  const state = createDemoState(businessId);
  state.vehicles = state.vehicles.filter((item) => item.id !== vehicleId);
  demoStates.set(businessId, state);
  return true;
}

export async function createReservationAssignment(input: AssignmentCreateInput) {
  const reservation = await getOperationsReservationById(input.businessId, input.reservationId);

  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (input.driverId) {
    const driver = (await listDriversByBusiness(input.businessId)).find(
      (item) => item.id === input.driverId,
    );

    if (!driver) {
      throw new Error("Driver not found.");
    }
  }

  if (input.vehicleId) {
    const vehicle = (await listVehiclesByBusiness(input.businessId)).find(
      (item) => item.id === input.vehicleId,
    );

    if (!vehicle) {
      throw new Error("Vehicle not found.");
    }
  }

  const payload = {
    business_id: input.businessId,
    reservation_id: input.reservationId,
    driver_id: input.driverId,
    vehicle_id: input.vehicleId,
    assigned_at: nowIso(),
    assigned_by: input.assignedBy,
    pickup_time: normalizeOptionalText(input.pickupTime),
    meeting_point: normalizeOptionalText(input.meetingPoint),
  };

  if (hasSupabaseConnection()) {
    const row = await writeSupabaseRecord(`/reservation_assignments`, payload, "POST");
    return row ? mapAssignment(row) : null;
  }

  const record: ReservationAssignmentRecord = {
    id: `assignment-${randomUUID()}`,
    businessId: input.businessId,
    reservationId: input.reservationId,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    assignedAt: nowIso(),
    assignedBy: input.assignedBy,
    pickupTime: normalizeOptionalText(input.pickupTime),
    meetingPoint: normalizeOptionalText(input.meetingPoint),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const state = createDemoState(input.businessId);
  state.assignments = [
    record,
    ...state.assignments.filter((item) => item.reservationId !== input.reservationId),
  ];
  demoStates.set(input.businessId, state);
  return record;
}

function getActiveReservationAssignment(
  assignments: ReservationAssignmentRecord[],
  reservationId: string,
) {
  return assignments.find((item) => item.reservationId === reservationId) ?? null;
}

function buildReservationLookup(
  reservations: OperationReservationRecord[],
  drivers: DriverRecord[],
  vehicles: VehicleRecord[],
  assignments: ReservationAssignmentRecord[],
) {
  const driverMap = new Map(drivers.map((item) => [item.id, item]));
  const vehicleMap = new Map(vehicles.map((item) => [item.id, item]));

  return reservations.map((reservation) => {
    const assignment = getActiveReservationAssignment(assignments, reservation.id);
    const driver = assignment?.driverId ? driverMap.get(assignment.driverId) : null;
    const vehicle = assignment?.vehicleId ? vehicleMap.get(assignment.vehicleId) : null;

    return {
      ...reservation,
      driverName: driver?.name ?? reservation.driverName ?? null,
      assignedVehicle:
        vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : reservation.assignedVehicle ?? null,
      pickupTime: assignment?.pickupTime ?? reservation.pickupTime ?? null,
      meetingPoint: assignment?.meetingPoint ?? reservation.meetingPoint ?? null,
    };
  });
}

export async function getOperationsReservationById(businessId: string, reservationId: string) {
  const data = await getOperationsBoardData(businessId);
  return data.reservations.find((item) => item.id === reservationId) ?? null;
}

export async function updateOperationStatus(
  businessId: string,
  reservationId: string,
  operationStatus: OperationBoardStatus,
) {
  const reservation = await getOperationsReservationById(businessId, reservationId);

  if (!reservation) {
    throw new Error("Reservation not found.");
  }

  if (hasSupabaseConnection()) {
    const row = await writeSupabaseRecord(
      `/requests?id=eq.${encodeURIComponent(reservationId)}&business_id=eq.${encodeURIComponent(
        businessId,
      )}`,
      {
        operation_status: operationStatus,
      },
      "PATCH",
    );
    return row ? mapReservation(row) : null;
  }

  const state = createDemoState(businessId);
  const existing = state.reservations.find((item) => item.id === reservationId);

  if (!existing) {
    throw new Error("Reservation not found.");
  }

  const updated = {
    ...existing,
    operationStatus,
  };

  state.reservations = state.reservations.map((item) =>
    item.id === reservationId ? updated : item,
  );
  demoStates.set(businessId, state);
  return updated;
}

export async function assignReservation(input: AssignmentCreateInput) {
  const assignment = await createReservationAssignment(input);
  const driver = input.driverId
    ? (await listDriversByBusiness(input.businessId)).find((item) => item.id === input.driverId) ??
      null
    : null;
  const vehicle = input.vehicleId
    ? (await listVehiclesByBusiness(input.businessId)).find((item) => item.id === input.vehicleId) ??
      null
    : null;

  await updateOperationStatus(input.businessId, input.reservationId, "Assigned");

  if (hasSupabaseConnection()) {
    await writeSupabaseRecord(
      `/requests?id=eq.${encodeURIComponent(input.reservationId)}&business_id=eq.${encodeURIComponent(
        input.businessId,
      )}`,
      {
        assigned_vehicle: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : null,
        driver_name: driver?.name ?? null,
        pickup_time: normalizeOptionalText(input.pickupTime),
        meeting_point: normalizeOptionalText(input.meetingPoint),
        operation_status: "Assigned",
      },
      "PATCH",
    );
  } else {
    const state = createDemoState(input.businessId);
    state.reservations = state.reservations.map((item) =>
      item.id === input.reservationId
        ? {
            ...item,
            assignedVehicle: vehicle ? `${vehicle.brand} ${vehicle.model}`.trim() : item.assignedVehicle,
            driverName: driver?.name ?? item.driverName,
            pickupTime: normalizeOptionalText(input.pickupTime),
            meetingPoint: normalizeOptionalText(input.meetingPoint),
            operationStatus: "Assigned",
          }
        : item,
    );
    demoStates.set(input.businessId, state);
  }

  return assignment;
}

export async function getOperationsBoardDataWithLookup(businessId?: string) {
  const [reservations, drivers, vehicles, assignments] = await Promise.all([
    listOperationReservations(businessId),
    listDrivers(businessId),
    listVehicles(businessId),
    listAssignments(businessId),
  ]);

  const resolvedReservations = buildReservationLookup(reservations, drivers, vehicles, assignments);
  const summary = getOperationSummary(resolvedReservations, drivers, vehicles);
  const columns = OPERATION_BOARD_STATUSES.map<OperationBoardColumn>((status) => ({
    status,
    title: status,
    items: resolvedReservations.filter((item) => item.operationStatus === status),
  }));

  return {
    reservations: resolvedReservations,
    assignments,
    drivers,
    vehicles,
    summary,
    columns,
  } satisfies OperationsBoardData;
}
