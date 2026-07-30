import { loadLocalEnv } from "./live-supabase.mjs";
import { analyzeMigrations } from "./migration-analyzer/analyze.mjs";
import { buildRepairPlan, formatRepairPlan, buildApplyOrder } from "./migration-analyzer/repair-plan.mjs";

// Salt-okunur. Hiçbir migration repair/db push/DDL komutu ÇALIŞTIRMAZ —
// yalnızca insan tarafından değerlendirilecek bir metin planı üretir.

async function main() {
  await loadLocalEnv();
  const dbUrl = String(process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "").trim();

  const results = await analyzeMigrations({ dbUrl: dbUrl || undefined });
  const plan = buildRepairPlan(results);
  console.log(formatRepairPlan(plan));

  const { order, unresolved } = buildApplyOrder(results);
  console.log("Önerilen uygulama sırası (yalnızca öneri):");
  console.log(order.length ? order.join(" -> ") : "(uygulanacak bir şey yok)");

  if (unresolved.length) {
    console.log("");
    console.log(
      `UYARI: şu migration'ların bağımlılıkları bu sıralamada çözülemedi: ${unresolved.join(", ")}. Elle inceleyin.`,
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
