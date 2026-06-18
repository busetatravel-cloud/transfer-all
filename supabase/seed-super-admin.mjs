import nextEnv from "@next/env";
import { randomBytes, scryptSync } from "node:crypto";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function readSeedValue(key) {
  return (process.env[key] ?? "").trim();
}

async function main() {
  const rawUrl = (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  ).trim();
  const url = rawUrl
    .replace(/^["']|["']$/g, "")
    .replace(/\/rest\/v1\/?$/, "")
    .replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const email = readSeedValue("SUPER_ADMIN_EMAIL");
  const password = readSeedValue("SUPER_ADMIN_PASSWORD");

  if (!url || !serviceKey) {
    throw new Error("Supabase baglantisi bulunamadi.");
  }

  if (!email || !password) {
    throw new Error("SUPER_ADMIN email ve password gerekli.");
  }

  const response = await fetch(`${url}/rest/v1/rpc/ensure_super_admin`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      p_email: email.toLowerCase(),
      p_password_hash: hashPassword(password),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `SUPER_ADMIN seed basarisiz oldu. HTTP ${response.status}: ${errorBody}`,
    );
    process.exitCode = 1;
    return;
  }

  const rows = await response.json();
  const record = Array.isArray(rows) ? rows[0] : null;

  if (!record) {
    throw new Error("SUPER_ADMIN seed cevabi alinmadi.");
  }

  console.log(
    record.created
      ? `SUPER_ADMIN olusturuldu: ${email.toLowerCase()}`
      : `SUPER_ADMIN zaten mevcut: ${email.toLowerCase()}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
