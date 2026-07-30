import { loadLocalEnv } from "./live-supabase.mjs";
import { runPreMigrationValidator, formatValidatorReport } from "./migration-analyzer/pre-migration-validator.mjs";

// Salt-okunur. Hiçbir migration/DDL komutu çalıştırmaz. Yalnızca "migration'a
// başlamak güvenli mi" sorusuna dair bir kontrol listesi üretir.

async function main() {
  await loadLocalEnv();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();

  const result = await runPreMigrationValidator({ dbUrl: dbUrl || undefined });
  console.log(formatValidatorReport(result));

  process.exitCode = result.safeToProceed ? 0 : 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
