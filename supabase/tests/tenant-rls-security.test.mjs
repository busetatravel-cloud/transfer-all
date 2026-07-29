import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

async function read(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

test("tenant rls migration defines secure helper functions and policies", async () => {
  const migration = await read("../migrations/0041_stage6_tenant_rls_security.sql");

  assert.match(migration, /create or replace function public\.current_business_id\(\)/i);
  assert.match(migration, /create or replace function public\.is_super_admin\(\)/i);
  assert.match(migration, /create or replace function public\.apply_uuid_tenant_rls\(target_table regclass\)/i);
  assert.match(migration, /create or replace function public\.apply_text_tenant_rls\(target_table regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.requests'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.pricing_rules'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.payments'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.drivers'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.vehicles'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.reservation_assignments'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.business_media_assets'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.business_analytics_events'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.business_customers'::regclass\)/i);
  assert.match(migration, /apply_uuid_tenant_rls\('public\.business_publication_revisions'::regclass\)/i);
  assert.match(migration, /apply_text_tenant_rls\('public\.audit_logs'::regclass\)/i);
  assert.match(migration, /apply_text_tenant_rls\('public\.business_voucher_delivery_logs'::regclass\)/i);
  assert.match(migration, /payments_business_reservation_fk/i);
  assert.match(migration, /reservation_assignments_business_driver_fk/i);
  assert.match(migration, /reservation_assignments_business_vehicle_fk/i);
  assert.match(migration, /business_vouchers_business_request_fk/i);
});

test("business routes reject tenant spoofing and validate related ids", async () => {
  const files = {
    reservationsCreate: await read("../../app/api/business/reservations/route.ts"),
    transferReservations: await read("../../app/api/business/transfer-reservations/route.ts"),
    pricingCalculate: await read("../../app/api/business/pricing/calculate/route.ts"),
    paymentsCreate: await read("../../app/api/business/payments/create/route.ts"),
    paymentsComplete: await read("../../app/api/business/payments/complete/route.ts"),
    assignmentCreate: await read("../../app/api/business/reservation-assignments/route.ts"),
    operationStatus: await read("../../app/api/business/operations/[reservationId]/route.ts"),
    reservationUpdate: await read("../../app/api/business/reservations/[id]/route.ts"),
  };

  for (const [name, source] of Object.entries(files)) {
    assert.match(source, /ensureNoBusinessIdSpoofing|session ile uyusmuyor|businessId session/i, name);
  }

  assert.match(files.paymentsCreate, /getReservationById\(auth\.session\.businessId, reservationId\)/i);
  assert.match(files.paymentsComplete, /getPaymentById\(paymentId, auth\.session\.businessId\)/i);
  assert.match(files.assignmentCreate, /ensureNoBusinessIdSpoofing/i);
  assert.match(files.operationStatus, /ensureNoBusinessIdSpoofing/i);
  assert.match(files.reservationUpdate, /ensureNoBusinessIdSpoofing/i);
});

test("service layer validates tenant ownership for payments and assignments", async () => {
  const payments = await read("../../lib/payments.ts");
  const operations = await read("../../lib/operations.ts");

  assert.match(payments, /const reservation = await getReservationById\(input\.businessId, input\.reservationId\)/i);
  assert.match(payments, /const existingPayment = await getPaymentById\(input\.paymentId, input\.businessId\)/i);
  assert.match(operations, /const reservation = await getOperationsReservationById\(input\.businessId, input\.reservationId\)/i);
  assert.match(operations, /Driver not found\./i);
  assert.match(operations, /Vehicle not found\./i);
  assert.match(operations, /Reservation not found\./i);
});
