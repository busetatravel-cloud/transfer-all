import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(source) {
  const result = {};

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }

  return result;
}

async function loadLocalEnv() {
  try {
    const raw = await readFile(new URL("../../.env.local", import.meta.url), "utf8");
    const parsed = parseEnvFile(raw);

    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key] && value) {
        process.env[key] = value;
      }
    }
  } catch {
    // Best-effort.
  }
}

function normalizeSupabaseUrl(value) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
}

function getConfig() {
  return {
    url: normalizeSupabaseUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    ),
    anonKey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim(),
    serviceKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
    superAdminEmail: String(process.env.SUPER_ADMIN_EMAIL || "").trim(),
    superAdminPassword: String(process.env.SUPER_ADMIN_PASSWORD || "").trim(),
  };
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function restRequest(config, path, init = {}, tokenType = "service") {
  const key = tokenType === "service" ? config.serviceKey : config.anonKey;
  const response = await fetchWithTimeout(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await readJson(response);
  return { response, body };
}

async function authAdminRequest(config, path, init = {}) {
  const response = await fetchWithTimeout(`${config.url}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await readJson(response);
  return { response, body };
}

async function authSignIn(config, email, password) {
  const client = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const result = await client.auth.signInWithPassword({
    email,
    password,
  });

  return {
    response: { ok: !result.error, status: result.error ? result.error.status ?? 400 : 200 },
    body: result.error
      ? { message: result.error.message, code: result.error.code }
      : {
          access_token: result.data.session?.access_token ?? null,
          refresh_token: result.data.session?.refresh_token ?? null,
          user: result.data.user ?? null,
        },
  };
}

async function probeLiveConfig(config) {
  if (!config.url || !config.anonKey || !config.serviceKey) {
    return { ready: false, missingTables: ["config"] };
  }

  const requiredTables = [
    "requests",
    "drivers",
    "vehicles",
    "reservation_assignments",
    "payments",
    "businesses",
    "users",
  ];

  const missingTables = [];

  try {
    for (const table of requiredTables) {
      const result = await restRequest(config, `/${table}?select=id&limit=1`);
      if (!result.response.ok && result.response.status === 404) {
        missingTables.push(table);
      }
      if (
        typeof result.body === "object" &&
        result.body &&
        !Array.isArray(result.body) &&
        String(result.body.code ?? "") === "PGRST205"
      ) {
        missingTables.push(table);
      }
    }
  } catch {
    return { ready: false, missingTables: ["network"] };
  }

  return {
    ready: missingTables.length === 0,
    missingTables,
  };
}

async function createTempTenant(config, label) {
  const suffix = randomUUID().slice(0, 8);
  const businessEmail = `${label}.${suffix}@example.com`.toLowerCase();
  const adminEmail = `${label}.${suffix}.admin@example.com`.toLowerCase();
  const adminPassword = `Temp-${suffix}-Pass!1`;
  const businessName = `Smoke ${label.toUpperCase()} ${suffix}`;

  const businessCreate = await restRequest(
    config,
    "/businesses",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: businessName,
        email: businessEmail,
        phone: "+90 555 000 00 00",
        whatsapp: "+90 555 000 00 00",
        active: true,
        domain: `${label}-${suffix}.example.com`,
      }),
    },
    "service",
  );

  assert.ok(businessCreate.response.ok, `business create failed: ${JSON.stringify(businessCreate.body)}`);
  assert.ok(Array.isArray(businessCreate.body) && businessCreate.body[0], "business was not created");

  const businessId = String(businessCreate.body[0].id);

  const userCreate = await restRequest(
    config,
    "/users",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: businessId,
        role: "BUSINESS_ADMIN",
        email: adminEmail,
        password_hash: `hash-${suffix}`,
        password_plaintext: adminPassword,
        password_changed_at: new Date().toISOString(),
        last_login_at: null,
        deleted_at: null,
        active: true,
      }),
    },
    "service",
  );

  assert.ok(userCreate.response.ok, `public user create failed: ${JSON.stringify(userCreate.body)}`);
  assert.ok(Array.isArray(userCreate.body) && userCreate.body[0], "public user was not created");

  const userId = String(userCreate.body[0].id);

  const authCreate = await authAdminRequest(config, "/users", {
    method: "POST",
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      app_metadata: { businessId },
      user_metadata: { businessId },
    }),
  });

  assert.ok(authCreate.response.ok, `auth user create failed: ${JSON.stringify(authCreate.body)}`);
  const authUserId = String(authCreate.body?.id ?? authCreate.body?.user?.id ?? "");
  assert.ok(authUserId, "auth user id missing");

  const patchResult = await restRequest(
    config,
    `/users?id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({ auth_user_id: authUserId }),
    },
    "service",
  );

  assert.ok(patchResult.response.ok, `public user patch failed: ${JSON.stringify(patchResult.body)}`);

  const signInResult = await authSignIn(config, adminEmail, adminPassword);
  assert.ok(signInResult.response.ok, `sign in failed: ${JSON.stringify(signInResult.body)}`);
  const accessToken = String(signInResult.body?.access_token ?? "");
  assert.ok(accessToken, "access token missing");

  return {
    businessId,
    userId,
    authUserId,
    email: adminEmail,
    password: adminPassword,
    token: accessToken,
  };
}

async function createReservation(config, businessId, title) {
  const result = await restRequest(
    config,
    "/requests",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: businessId,
        customer_name: `${title} Customer`,
        phone: "+90 555 111 22 33",
        email: `${title}@example.com`,
        message: `${title} message`,
        status: "new",
      }),
    },
    "service",
  );

  assert.ok(result.response.ok, `reservation create failed: ${JSON.stringify(result.body)}`);
  return result.body[0];
}

async function createDriver(config, businessId, name) {
  const result = await restRequest(
    config,
    "/drivers",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: businessId,
        name,
        phone: "+90 555 111 22 33",
        email: `${name.replace(/\s+/g, ".").toLowerCase()}@example.com`,
        active: true,
        notes: "smoke",
      }),
    },
    "service",
  );

  assert.ok(result.response.ok, `driver create failed: ${JSON.stringify(result.body)}`);
  return result.body[0];
}

async function createVehicle(config, businessId, name) {
  const result = await restRequest(
    config,
    "/vehicles",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: businessId,
        plate: `SMK-${randomUUID().slice(0, 6).toUpperCase()}`,
        brand: "Test",
        model: name,
        capacity: 4,
        active: true,
      }),
    },
    "service",
  );

  assert.ok(result.response.ok, `vehicle create failed: ${JSON.stringify(result.body)}`);
  return result.body[0];
}

async function createPayment(config, businessId, reservationId) {
  const result = await restRequest(
    config,
    "/payments",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        business_id: businessId,
        reservation_id: reservationId,
        provider: "manual",
        amount: 100,
        currency: "TRY",
        status: "Pending",
      }),
    },
    "service",
  );

  assert.ok(result.response.ok, `payment create failed: ${JSON.stringify(result.body)}`);
  return result.body[0];
}

async function cleanupAuthUser(config, userId) {
  if (!userId) {
    return;
  }

  await authAdminRequest(config, `/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  }).catch(() => null);
}

async function cleanupBusiness(config, businessId) {
  if (!businessId) {
    return;
  }

  await restRequest(
    config,
    `/businesses?id=eq.${encodeURIComponent(businessId)}`,
    { method: "DELETE" },
    "service",
  ).catch(() => null);
}

await loadLocalEnv();

const config = getConfig();
const liveProbe = await probeLiveConfig(config);
const smoke = liveProbe.ready ? test : test.skip;

smoke("tenant policy smoke", async () => {
  const tempA = await createTempTenant(config, "tenant-a");
  const tempB = await createTempTenant(config, "tenant-b");

  const created = {
    businesses: [tempA.businessId, tempB.businessId],
    authUsers: [tempA.authUserId, tempB.authUserId],
    reservations: [],
    drivers: [],
    vehicles: [],
    payments: [],
  };

  try {
    const reservationA = await createReservation(config, tempA.businessId, "A");
    const reservationB = await createReservation(config, tempB.businessId, "B");
    const driverB = await createDriver(config, tempB.businessId, "Tenant B Driver");
    const vehicleB = await createVehicle(config, tempB.businessId, "Tenant B Vehicle");
    const paymentB = await createPayment(config, tempB.businessId, reservationB.id);

    created.reservations.push(reservationA.id, reservationB.id);
    created.drivers.push(driverB.id);
    created.vehicles.push(vehicleB.id);
    created.payments.push(paymentB.id);

    const anonRead = await restRequest(config, "/requests?select=id&limit=1", {}, "anon");
    assert.ok(!anonRead.response.ok, "anon user should not read tenant tables");

    const tenantARead = await fetchWithToken(
      config,
      `/requests?select=id,business_id&id=eq.${encodeURIComponent(reservationA.id)}`,
      tempA.token,
    );
    assert.ok(tenantARead.response.ok, "tenant A should read own reservation");
    assert.equal(tenantARead.body.length, 1);
    assert.equal(String(tenantARead.body[0].id), String(reservationA.id));

    const tenantABlockedRead = await fetchWithToken(
      config,
      `/requests?select=id,business_id&id=eq.${encodeURIComponent(reservationB.id)}`,
      tempA.token,
    );
    assert.ok(tenantABlockedRead.response.ok, "tenant A blocked read should still return ok");
    assert.equal(tenantABlockedRead.body.length, 0, "tenant A should not read tenant B reservation");

    const insertSpoof = await fetchWithToken(
      config,
      "/requests",
      {
        method: "POST",
        body: JSON.stringify({
          business_id: tempB.businessId,
          customer_name: "Spoof",
          message: "Spoof",
        }),
      },
      tempA.token,
    );
    assert.ok(!insertSpoof.response.ok, "tenant A must not insert into tenant B");

    const updateSpoof = await fetchWithToken(
      config,
      `/requests?id=eq.${encodeURIComponent(reservationB.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          message: "changed by tenant A",
        }),
      },
      tempA.token,
    );
    assert.ok(!updateSpoof.response.ok, "tenant A must not update tenant B");
    const bAfterUpdate = await restRequest(
      config,
      `/requests?id=eq.${encodeURIComponent(reservationB.id)}&select=id,message,business_id`,
      {},
      "service",
    );
    assert.equal(String(bAfterUpdate.body[0].message), "B message");

    const deleteSpoof = await fetchWithToken(
      config,
      `/requests?id=eq.${encodeURIComponent(reservationB.id)}`,
      { method: "DELETE" },
      tempA.token,
    );
    assert.ok(!deleteSpoof.response.ok, "tenant A must not delete tenant B");
    const bAfterDelete = await restRequest(
      config,
      `/requests?id=eq.${encodeURIComponent(reservationB.id)}&select=id`,
      {},
      "service",
    );
    assert.equal(bAfterDelete.body.length, 1, "tenant B reservation should still exist");

    const assignmentSpoof = await fetchWithToken(
      config,
      "/reservation_assignments",
      {
        method: "POST",
        body: JSON.stringify({
          business_id: tempA.businessId,
          reservation_id: reservationA.id,
          driver_id: driverB.id,
          vehicle_id: vehicleB.id,
          assigned_by: tempA.userId,
        }),
      },
      tempA.token,
    );
    assert.ok(!assignmentSpoof.response.ok, "cross-tenant assignment must fail");

    const paymentSpoof = await fetchWithToken(
      config,
      `/payments?id=eq.${encodeURIComponent(paymentB.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "Paid",
        }),
      },
      tempA.token,
    );
    assert.ok(!paymentSpoof.response.ok, "tenant A must not complete tenant B payment");
    const paymentAfter = await restRequest(
      config,
      `/payments?id=eq.${encodeURIComponent(paymentB.id)}&select=id,status,business_id`,
      {},
      "service",
    );
    assert.equal(String(paymentAfter.body[0].status), "Pending");

    const superAdmin = await authSignIn(
      config,
      config.superAdminEmail,
      config.superAdminPassword,
    );
    assert.ok(superAdmin.response.ok, "super admin sign in failed");
    const superToken = String(superAdmin.body?.access_token ?? "");
    assert.ok(superToken, "super admin token missing");

    const superRead = await fetchWithToken(config, "/requests?select=id,business_id", superToken);
    assert.ok(superRead.response.ok, "super admin should read tenant tables");
    const ids = new Set(superRead.body.map((row) => String(row.business_id)));
    assert.ok(ids.has(tempA.businessId), "super admin should see tenant A");
    assert.ok(ids.has(tempB.businessId), "super admin should see tenant B");
  } finally {
    for (const authUserId of created.authUsers.reverse()) {
      await cleanupAuthUser(config, authUserId);
    }
    for (const businessId of created.businesses.reverse()) {
      await cleanupBusiness(config, businessId);
    }
  }
});

async function fetchWithToken(config, path, token, init = {}) {
  const response = await fetchWithTimeout(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  return {
    response,
    body: await readJson(response),
  };
}
