import { loadLocalEnv, getSupabaseCliCandidate, cliLooksAvailable, runSupabase, getDbTargetArgs, runSupabaseSql, parseJsonIfPossible, parseTableRows } from "./live-supabase.mjs";
import { spawnSync } from "node:child_process";

function parseIssueCountFromRows(rows) {
  return rows.reduce((total, row) => {
    const value = Number(row?.issue_count ?? row?.issueCount ?? 0);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function summarizePreflight(rows) {
  const total = parseIssueCountFromRows(rows);
  const tables = new Map();

  for (const row of rows) {
    const tableName = String(row?.table_name ?? row?.schema_table ?? row?.table ?? "unknown");
    const issueType = String(row?.issue_type ?? row?.issueType ?? "unknown");
    const count = Number(row?.issue_count ?? row?.issueCount ?? 0);
    if (!tables.has(tableName)) {
      tables.set(tableName, []);
    }
    tables.get(tableName).push({ issueType, count, samples: String(row?.sample_record_ids ?? row?.sampleRecordIds ?? "") });
  }

  return { total, tables };
}

async function runSqlFileOrQuery(cli, dbUrl, sql, label) {
  const result = await runSupabaseSql({
    sql,
    dbUrl,
    linked: !dbUrl,
    label,
  });

  if (result.status !== 0) {
    throw new Error(`${label} calistirlamadi.\nSTDERR: ${result.stderr || "(empty)"}\nSTDOUT: ${result.stdout || "(empty)"}`);
  }

  const parsed = parseJsonIfPossible(result.stdout);
  if (Array.isArray(parsed)) {
    return parsed;
  }

  return parseTableRows(result.stdout).map((cells) => ({
    table_name: cells[0],
    issue_type: cells[1],
    issue_count: Number(cells[2] ?? 0),
    sample_record_ids: cells[3] ?? "",
  }));
}

async function main() {
  await loadLocalEnv();

  const cli = getSupabaseCliCandidate();
  if (!cliLooksAvailable(cli)) {
    throw new Error(
      `Supabase CLI bulunamadi. Lutfen CLI kurun ya da SUPABASE_CLI_PATH tanimlayin. Denenen komut: ${cli}`,
    );
  }

  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  const targetArgs = getDbTargetArgs({ dbUrl, linked: !dbUrl });

  console.log("1) Migration status kontrolu");
  const statusResult = runSupabase(["--output", "json", "migration", "list", ...targetArgs], { cli });
  if (statusResult.status !== 0) {
    throw new Error(`Migration status alinmadi.\nSTDERR: ${statusResult.stderr || "(empty)"}\nSTDOUT: ${statusResult.stdout || "(empty)"}`);
  }
  console.log(statusResult.stdout.trim() || "(bos cikti)");

  console.log("2) Kritik tablolarin varlik kontrolu");
  const tableSql = `
    select
      table_name,
      to_regclass(format('public.%I', table_name)) is not null as visible
    from unnest(array[
      'requests',
      'pricing_rules',
      'payments',
      'drivers',
      'vehicles',
      'reservation_assignments',
      'business_vouchers',
      'business_publication_revisions',
      'business_publication_businesses',
      'business_publication_profiles',
      'business_publication_media_assets',
      'business_publication_services',
      'business_publication_vehicles',
      'business_publication_routes',
      'business_publication_blog_posts',
      'business_publication_seo',
      'business_publication_locales',
      'business_publication_translations',
      'audit_logs',
      'business_voucher_delivery_logs'
    ]) as table_name
  `;
  const tableVisibility = await runSqlFileOrQuery(cli, dbUrl, tableSql, "table-visibility");
  console.log(JSON.stringify(tableVisibility, null, 2));

  console.log("3) Preflight SQL");
  const preflightSql = await runSqlFileOrQuery(
    cli,
    dbUrl,
    await (await import("node:fs/promises")).readFile(new URL("../supabase/scripts/validate_tenant_security_preflight.sql", import.meta.url), "utf8"),
    "preflight",
  );
  const preflightSummary = summarizePreflight(preflightSql);
  console.log(JSON.stringify({ issue_count: preflightSummary.total, issues: Array.from(preflightSummary.tables.entries()) }, null, 2));

  console.log("4) RLS status report");
  const rlsStatus = await runSqlFileOrQuery(
    cli,
    dbUrl,
    await (await import("node:fs/promises")).readFile(new URL("../supabase/scripts/report_rls_status.sql", import.meta.url), "utf8"),
    "rls-status",
  );
  console.log(JSON.stringify(rlsStatus, null, 2));

  console.log("5) Tenant RLS test");
  const tenantRlsTest = spawnSync(process.execPath, ["--test", "supabase/tests/tenant-rls-security.test.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  if (tenantRlsTest.status !== 0) {
    throw new Error(`tenant-rls-security testi basarisiz.\nSTDERR: ${tenantRlsTest.stderr || "(empty)"}\nSTDOUT: ${tenantRlsTest.stdout || "(empty)"}`);
  }
  console.log(tenantRlsTest.stdout.trim() || "tenant-rls-security testi gecti.");

  console.log("6) Policy smoke test");
  const smokeTest = spawnSync(process.execPath, ["--test", "supabase/tests/tenant-policy-smoke.test.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
  });
  if (smokeTest.status !== 0) {
    throw new Error(`tenant-policy-smoke testi basarisiz.\nSTDERR: ${smokeTest.stderr || "(empty)"}\nSTDOUT: ${smokeTest.stdout || "(empty)"}`);
  }
  console.log(smokeTest.stdout.trim() || "tenant-policy-smoke testi gecti.");

  if (preflightSummary.total === 0) {
    console.log("7) Constraint validation");
    const constraintSql = await (await import("node:fs/promises")).readFile(new URL("../supabase/scripts/validate_tenant_constraints.sql", import.meta.url), "utf8");
    const constraintResult = await runSqlFileOrQuery(cli, dbUrl, constraintSql, "constraint-validation");
    console.log(JSON.stringify(constraintResult, null, 2));
    console.log("Constraint'ler validate edildi.");
  } else {
    console.log("7) Constraint validation atlandi; preflight sorunlari temiz degil.");
  }

  console.log("Sonuc ozeti");
  console.log(`- Preflight issue count: ${preflightSummary.total}`);
  console.log(`- Table visibility checked: ${tableVisibility.length}`);
  console.log(`- RLS status rows: ${rlsStatus.length}`);
  console.log(`- Tenant RLS test: passed`);
  console.log(`- Policy smoke test: passed`);
  console.log(`- Constraint validation: ${preflightSummary.total === 0 ? "passed" : "skipped"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
