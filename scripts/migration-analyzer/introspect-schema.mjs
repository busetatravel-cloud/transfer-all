import { getDbTargetArgs, runSupabaseSql } from "../live-supabase.mjs";

// Bu modüldeki HER fonksiyon yalnızca `select` çalıştırır. runReadOnlyQuery,
// kazara yazma amaçlı bir SQL'in bu yoldan geçmesine karşı son bir güvenlik
// denetimi yapar (yalnızca "select" ile başlayan sorgulara izin verir).
async function runReadOnlyQuery(sql, dbUrl) {
  const trimmed = sql.trim();
  if (!/^select\b/i.test(trimmed)) {
    throw new Error(
      "introspect-schema.mjs yalnızca salt-okunur (select) sorgular çalıştırabilir. Reddedilen sorgu: " +
        trimmed.slice(0, 80),
    );
  }

  const linked = !dbUrl;
  const result = await runSupabaseSql({ sql: trimmed, dbUrl, linked, label: "introspect" });

  if (result.status !== 0) {
    throw new Error(
      `Salt-okunur sorgu başarısız oldu.\nSTDERR: ${result.stderr || "(empty)"}\nSTDOUT: ${result.stdout || "(empty)"}`,
    );
  }

  const jsonStart = result.stdout.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("Sorgu çıktısı JSON olarak ayrıştırılamadı: " + result.stdout.slice(0, 200));
  }

  const parsed = JSON.parse(result.stdout.slice(jsonStart));

  if (parsed?._tag === "Error") {
    throw new Error("Supabase CLI sorgu hatası: " + (parsed.error?.message ?? JSON.stringify(parsed)));
  }

  return Array.isArray(parsed.rows) ? parsed.rows : [];
}

export async function getLiveTables(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select table_name
     from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
     order by table_name;`,
    dbUrl,
  );
  return rows.map((row) => row.table_name);
}

export async function getLiveColumns(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select table_name, column_name
     from information_schema.columns
     where table_schema = 'public'
     order by table_name, ordinal_position;`,
    dbUrl,
  );
  const byTable = new Map();
  for (const row of rows) {
    const list = byTable.get(row.table_name) ?? new Set();
    list.add(row.column_name);
    byTable.set(row.table_name, list);
  }
  return byTable;
}

export async function getLiveEnumValues(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select t.typname as enum_name, e.enumlabel as value
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     order by t.typname, e.enumsortorder;`,
    dbUrl,
  );
  const byType = new Map();
  for (const row of rows) {
    const list = byType.get(row.enum_name) ?? new Set();
    list.add(row.value);
    byType.set(row.enum_name, list);
  }
  return byType;
}

export async function getLiveTriggers(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select event_object_table as table_name, trigger_name
     from information_schema.triggers
     where trigger_schema = 'public'
     group by event_object_table, trigger_name
     order by table_name, trigger_name;`,
    dbUrl,
  );
  return new Set(rows.map((row) => row.trigger_name));
}

export async function getLiveFunctions(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select p.proname as function_name
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
     order by p.proname;`,
    dbUrl,
  );
  return new Set(rows.map((row) => row.function_name));
}

export async function getLiveIndexes(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select indexname as index_name, tablename as table_name
     from pg_indexes
     where schemaname = 'public'
     order by tablename, indexname;`,
    dbUrl,
  );
  return new Set(rows.map((row) => row.index_name));
}

export async function getLiveConstraints(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select conname as constraint_name, contype as constraint_type, conrelid::regclass::text as table_name
     from pg_constraint
     where connamespace = 'public'::regnamespace
     order by conname;`,
    dbUrl,
  );
  return new Set(rows.map((row) => row.constraint_name));
}

export async function getLivePolicies(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select tablename as table_name, policyname as policy_name
     from pg_policies
     where schemaname = 'public'
     order by tablename, policyname;`,
    dbUrl,
  );
  return new Set(rows.map((row) => row.policy_name));
}

export async function getLiveRlsStatus(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select relname as table_name, relrowsecurity as rls_enabled, relforcerowsecurity as force_rls
     from pg_class
     where relnamespace = 'public'::regnamespace and relkind = 'r'
     order by relname;`,
    dbUrl,
  );
  const byTable = new Map();
  for (const row of rows) {
    byTable.set(row.table_name, { rlsEnabled: row.rls_enabled, forceRls: row.force_rls });
  }
  return byTable;
}

export async function getMigrationTrackingTableExists(dbUrl) {
  const rows = await runReadOnlyQuery(
    `select 1 as found
     from information_schema.tables
     where table_schema = 'supabase_migrations' and table_name = 'schema_migrations';`,
    dbUrl,
  );
  return rows.length > 0;
}

export async function getOrphanBusinessIdCount(dbUrl, table, businessIdColumn = "business_id") {
  // Yalnızca business_id kolonu olan tablolarda anlamlıdır; tablo yoksa hata
  // fırlatmak yerine null döner (çağıran, "tablo yok" durumunu ayrı ele almalı).
  try {
    const rows = await runReadOnlyQuery(
      `select count(*) as orphan_count
       from public.${table} t
       left join public.businesses b on b.id::text = t.${businessIdColumn}::text
       where t.${businessIdColumn} is not null and b.id is null;`,
      dbUrl,
    );
    return Number(rows[0]?.orphan_count ?? 0);
  } catch {
    return null;
  }
}

// business_id kolonu olan her tablo için ayrı bir CLI çağrısı yapmak yavaştır
// (her çağrı ~15-20sn sürüyor; 15+ tablo = birkaç dakika). Bunun yerine TÜM
// tabloları TEK bir "union all" sorgusunda birleştirip tek çağrıda sonuç alır.
export async function getOrphanBusinessIdCounts(dbUrl, tables, businessIdColumn = "business_id") {
  if (!tables.length) {
    return new Map();
  }

  const unionSql = tables
    .map(
      (table) => `select '${table}' as table_name, count(*) as orphan_count
        from public.${table} t
        left join public.businesses b on b.id::text = t.${businessIdColumn}::text
        where t.${businessIdColumn} is not null and b.id is null`,
    )
    .join("\nunion all\n");

  const rows = await runReadOnlyQuery(`${unionSql};`, dbUrl);
  const result = new Map();
  for (const row of rows) {
    result.set(row.table_name, Number(row.orphan_count ?? 0));
  }
  return result;
}

export async function getLinkedProjectRef() {
  const targetArgs = getDbTargetArgs({});
  return targetArgs;
}
