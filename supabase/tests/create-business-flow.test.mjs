import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

test("first business creation flow is duplicate-safe", async () => {
  const initSql = await readFile(
    new URL("../migrations/0001_init.sql", import.meta.url),
    "utf8",
  );
  const sql = await readFile(
    new URL("../migrations/0003_stage6_real_supabase_activation.sql", import.meta.url),
    "utf8",
  );
  const sharedSql = await readFile(
    new URL("../migrations/0004_stage6_shared_business_email.sql", import.meta.url),
    "utf8",
  );
  const passwordSql = await readFile(
    new URL("../migrations/0007_stage6_password_sync.sql", import.meta.url),
    "utf8",
  );
  const softDeleteSql = await readFile(
    new URL("../migrations/0008_stage6_admin_soft_delete.sql", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(initSql, /uniq_businesses_email_lower/);
  assert.match(sql, /create or replace function create_business_with_admin/);
  assert.match(sql, /if exists \(\s*select 1\s*from users\s*where lower\(email\) = normalized_admin_email/si);
  assert.match(sql, /raise exception 'Admin email already exists'/);
  assert.doesNotMatch(sql, /where lower\(email\) = normalized_business_email/i);
  assert.match(sql, /insert into users \(/i);
  assert.match(sql, /ensure_super_admin/);
  assert.match(sharedSql, /drop index if exists uniq_businesses_email_lower/i);
  assert.match(passwordSql, /password_plaintext/i);
  assert.match(passwordSql, /password_changed_at/i);
  assert.doesNotMatch(passwordSql, /p_admin_password text/i);
  assert.match(passwordSql, /create or replace function create_business_with_admin/);
  assert.match(
    passwordSql,
    /p_name text,\s*p_email text,\s*p_admin_email text,\s*p_admin_password_hash text,\s*p_phone text default null,\s*p_whatsapp text default null,\s*p_domain text default null/s,
  );
  assert.match(softDeleteSql, /add column if not exists deleted_at timestamptz/i);
  assert.match(softDeleteSql, /deleted_at is null/i);
});

test("super admin seed reads only env credentials", async () => {
  const script = await readFile(
    new URL("../seed-super-admin.mjs", import.meta.url),
    "utf8",
  );

  assert.match(script, /SUPER_ADMIN_EMAIL/);
  assert.match(script, /SUPER_ADMIN_PASSWORD/);
  assert.doesNotMatch(script, /process\.argv/);
});
