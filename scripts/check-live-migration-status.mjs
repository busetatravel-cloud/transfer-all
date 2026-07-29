import {
  loadLocalEnv,
  runSupabase,
  parseMigrationListOutput,
  analyzeMigrationStatus,
  formatStatusReport,
  cliLooksAvailable,
  getSupabaseCliCandidate,
  getDbTargetArgs,
  analyzeLocalMigrationSet,
  formatLocalMigrationIssues,
} from "./live-supabase.mjs";

async function main() {
  await loadLocalEnv();

  const cli = getSupabaseCliCandidate();
  const localReport = await analyzeLocalMigrationSet();
  const localVersions = localReport.versions.map((item) => item.version);

  if (!cliLooksAvailable(cli)) {
    console.log("Migration status report");
    console.log(formatLocalMigrationIssues(localReport));
    console.log("Remote comparison: unavailable (Supabase CLI not found)");
    const localStatus = analyzeMigrationStatus(localReport.versions, localVersions);
    console.log("Tracked migrations:");
    for (const item of localStatus.tracked) {
      console.log(`- ${item.version}: local=${item.local ? "yes" : "no"}, remote=unavailable`);
    }
    console.log(`Supabase CLI not found. Install it or set SUPABASE_CLI_PATH. Tried command: ${cli}`);
    process.exitCode =
      localReport.duplicatePrefixes.length ||
      localReport.versionOrderIssues.length ||
      localReport.missingNumbers.length ||
      localReport.duplicateContents.length
        ? 1
        : 0;
    return;
  }

  if (
    localReport.duplicatePrefixes.length ||
    localReport.versionOrderIssues.length ||
    localReport.missingNumbers.length ||
    localReport.duplicateContents.length
  ) {
    console.log("Migration status report");
    console.log(formatLocalMigrationIssues(localReport));
    console.log("Remote comparison skipped because local migration set has integrity issues.");
    process.exitCode = 1;
    return;
  }

  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();
  const targetArgs = getDbTargetArgs({ dbUrl, linked: !dbUrl });

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

  const status = analyzeMigrationStatus(localReport.versions, remoteVersions);

  console.log(formatStatusReport(status));

  if (status.localOnly.length) {
    console.log(`Local-only migrations: ${status.localOnly.join(", ")}`);
  }
  if (status.remoteOnly.length) {
    console.log(`Remote-only migrations: ${status.remoteOnly.join(", ")}`);
  }
  if (status.orderIssues.length) {
    console.log("Migration order issues found.");
  }

  process.exitCode = 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
