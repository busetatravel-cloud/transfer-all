import {
  loadLocalEnv,
  runSupabase,
  parseMigrationListOutput,
  analyzeMigrationStatus,
  cliLooksAvailable,
  getSupabaseCliCandidate,
  getDbTargetArgs,
  assertConfirmProduction,
  runSupabaseSql,
  analyzeLocalMigrationSet,
  formatLocalMigrationIssues,
} from "./live-supabase.mjs";

async function getStatus(cli, dbUrl) {
  const targetArgs = getDbTargetArgs({ dbUrl, linked: !dbUrl });
  const localReport = await analyzeLocalMigrationSet();

  const result = runSupabase(["--output", "json", "migration", "list", ...targetArgs], { cli });

  if (result.status !== 0) {
    throw new Error(
      `supabase migration list failed.\nSTDERR: ${result.stderr || "(empty)"}\nSTDOUT: ${result.stdout || "(empty)"}`,
    );
  }

  let remoteVersions = [];
  try {
    const json = JSON.parse(result.stdout);
    if (Array.isArray(json)) {
      remoteVersions = json
        .map((item) => String(item?.remote ?? item?.REMOTE ?? item?.version ?? "").trim())
        .filter((value) => /^\d{14}$/.test(value));
    }
  } catch {
    // fall back to table parsing
  }

  if (remoteVersions.length === 0) {
    remoteVersions = parseMigrationListOutput(result.stdout).remote;
  }

  const localStatus = analyzeMigrationStatus(localReport.versions, remoteVersions);
  return { localReport, localStatus };
}

async function main() {
  await loadLocalEnv();
  assertConfirmProduction();

  const cli = getSupabaseCliCandidate();
  if (!cliLooksAvailable(cli)) {
    throw new Error(`Supabase CLI not found. Install it or set SUPABASE_CLI_PATH. Tried command: ${cli}`);
  }

  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  const { localReport, localStatus } = await getStatus(cli, dbUrl);

  if (
    localReport.duplicatePrefixes.length ||
    localReport.versionOrderIssues.length ||
    localReport.missingNumbers.length ||
    localReport.duplicateContents.length
  ) {
    console.log("Local migration integrity issues detected:");
    console.log(formatLocalMigrationIssues(localReport));
    throw new Error("Local migration set must be repaired before live apply.");
  }

  if (localStatus.remoteOnly.length) {
    throw new Error(
      `Remote-only migrations exist. Repair migration history first: ${localStatus.remoteOnly.join(", ")}`,
    );
  }

  if (localStatus.orderIssues.length) {
    throw new Error(
      `Local migration order is broken. Fix first: ${localStatus.orderIssues
        .map((item) => item.version || item.file || item.files?.join("/"))
        .join(", ")}`,
    );
  }

  if (!localStatus.localOnly.length) {
    console.log("Live migration history is already aligned with local files.");
    return;
  }

  console.log(`Migrations to apply: ${localStatus.localOnly.join(", ")}`);

  const pushArgs = ["--output", "json", "db", "push", ...getDbTargetArgs({ dbUrl, linked: !dbUrl }), "--yes"];
  const pushResult = runSupabase(pushArgs, { cli });

  if (pushResult.status !== 0) {
    throw new Error(
      `supabase db push failed.\nSTDERR: ${pushResult.stderr || "(empty)"}\nSTDOUT: ${pushResult.stdout || "(empty)"}`,
    );
  }

  console.log(pushResult.stdout.trim() || "Migration push completed.");

  const reloadResult = await runSupabaseSql({
    sql: "notify pgrst, 'reload schema';",
    dbUrl,
    linked: !dbUrl,
    label: "reload-schema",
  });

  if (reloadResult.status !== 0) {
    throw new Error(`Schema cache reload failed: ${reloadResult.stderr || reloadResult.stdout || "(empty)"}`);
  }

  const visibilityChecks = ["pricing_rules", "payments", "drivers", "vehicles", "reservation_assignments"];
  const visibilitySql = `
    select
      table_name,
      to_regclass(format('public.%I', table_name)) is not null as visible
    from unnest(array[${visibilityChecks.map((item) => `'${item}'`).join(", ")}]) as table_name
  `;

  const visibilityResult = await runSupabaseSql({
    sql: visibilitySql,
    dbUrl,
    linked: !dbUrl,
    label: "visibility-check",
  });

  if (visibilityResult.status !== 0) {
    throw new Error(`Table visibility check failed: ${visibilityResult.stderr || visibilityResult.stdout || "(empty)"}`);
  }

  console.log("Schema cache refreshed and critical tenant tables checked.");
  console.log("drivers, vehicles, pricing_rules, payments and reservation_assignments should be visible.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
