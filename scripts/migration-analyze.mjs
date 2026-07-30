import { loadLocalEnv, getDbTargetArgs } from "./live-supabase.mjs";
import { analyzeMigrations, statusSymbol } from "./migration-analyzer/analyze.mjs";

// Salt-okunur migration analiz raporu. Hiçbir DDL/DML çalıştırmaz.
// Kullanım: node scripts/migration-analyze.mjs [--verbose]

async function main() {
  await loadLocalEnv();

  const verbose = process.argv.includes("--verbose");
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();

  console.log("Migration Analyzer (salt-okunur)");
  console.log(`Hedef: ${getDbTargetArgs({ dbUrl, linked: !dbUrl }).join(" ") || "(linked)"}`);
  console.log("");

  const results = await analyzeMigrations({ dbUrl: dbUrl || undefined });

  let appliedCount = 0;
  let partialCount = 0;
  let missingCount = 0;
  let unknownCount = 0;

  for (const result of results) {
    const symbol = statusSymbol(result.status);
    console.log(`${symbol} ${result.version} ${result.status} (${result.presentChecks}/${result.totalChecks})`);

    if (result.status === "applied") appliedCount += 1;
    if (result.status === "partial") partialCount += 1;
    if (result.status === "missing") missingCount += 1;
    if (result.status === "unknown") unknownCount += 1;

    if ((verbose || result.status === "partial") && result.status !== "applied") {
      const missingItems = [
        ...result.details.tables.filter((i) => !i.present).map((i) => `table ${i.table}`),
        ...result.details.columns.filter((i) => !i.present).map((i) => `column ${i.table}.${i.column}`),
        ...result.details.enumValues.filter((i) => !i.present).map((i) => `enum ${i.type}.${i.value}`),
        ...result.details.triggers.filter((i) => !i.present).map((i) => `trigger ${i.name}`),
        ...result.details.functions.filter((i) => !i.present).map((i) => `function ${i.name}`),
        ...result.details.indexes.filter((i) => !i.present).map((i) => `index ${i.name}`),
        ...result.details.constraints.filter((i) => !i.present).map((i) => `constraint ${i.name}`),
        ...result.details.policies.filter((i) => !i.present).map((i) => `policy ${i.policyName}`),
      ];

      if (missingItems.length) {
        console.log(`    eksik: ${missingItems.join(", ")}`);
      }

      if (result.dependsOn.length) {
        console.log(`    bağımlı olduğu migration'lar: ${result.dependsOn.join(", ")}`);
      }
    }
  }

  console.log("");
  console.log(
    `Özet: ${appliedCount} applied, ${partialCount} partial, ${missingCount} missing, ${unknownCount} unknown`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
