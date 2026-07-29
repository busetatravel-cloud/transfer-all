export const OPERATION_STATUSES = [
  "Pending",
  "Confirmed",
  "Assigned",
  "Driver On The Way",
  "Passenger Picked Up",
  "In Progress",
  "Completed",
  "Cancelled",
  "No Show",
] as const;

export const OPERATION_BOARD_STATUSES = [
  "Pending",
  "Confirmed",
  "Assigned",
  "In Progress",
  "Completed",
] as const;

export type OperationStatus = (typeof OPERATION_STATUSES)[number];
export type OperationBoardStatus = (typeof OPERATION_BOARD_STATUSES)[number];

export type DriverRecord = {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleRecord = {
  id: string;
  businessId: string;
  plate: string;
  brand: string;
  model: string;
  capacity: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ReservationAssignmentRecord = {
  id: string;
  businessId: string;
  reservationId: string;
  driverId: string | null;
  vehicleId: string | null;
  assignedAt: string;
  assignedBy: string | null;
  pickupTime: string | null;
  meetingPoint: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OperationReservationRecord = {
  id: string;
  businessId: string;
  customerName: string;
  passengerName: string | null;
  origin: string | null;
  destination: string | null;
  travelDate: string | null;
  travelTime: string | null;
  flightCode: string | null;
  vehicleCategory: string | null;
  vehicleName: string | null;
  assignedVehicle: string | null;
  driverName: string | null;
  pickupTime: string | null;
  meetingPoint: string | null;
  operationStatus: OperationStatus;
  paymentStatus: string;
  bookingStatus: string;
  currency: string | null;
  totalAmount: number | null;
  createdAt: string;
};

export type OperationBoardColumn = {
  status: OperationBoardStatus;
  title: string;
  items: OperationReservationRecord[];
};

export type OperationsDashboardSummary = {
  todayTransfers: number;
  pendingReservations: number;
  confirmedReservations: number;
  waitingAssignments: number;
  activeTransfers: number;
  completedTransfers: number;
  cancelledTransfers: number;
  noShowTransfers: number;
  driversAvailable: number;
  vehiclesAvailable: number;
};

export type OperationsBoardData = {
  reservations: OperationReservationRecord[];
  assignments: ReservationAssignmentRecord[];
  drivers: DriverRecord[];
  vehicles: VehicleRecord[];
  summary: OperationsDashboardSummary;
  columns: OperationBoardColumn[];
};

export type DriverUpsertInput = {
  businessId: string;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  notes?: string | null;
};

export type VehicleUpsertInput = {
  businessId: string;
  plate: string;
  brand: string;
  model: string;
  capacity: number;
  active: boolean;
};

export type AssignmentCreateInput = {
  businessId: string;
  reservationId: string;
  driverId: string | null;
  vehicleId: string | null;
  assignedBy: string | null;
  pickupTime?: string | null;
  meetingPoint?: string | null;
};

