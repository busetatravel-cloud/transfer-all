import { existsSync, statSync } from "node:fs";
import { runSupabase, getSupabaseCliCandidate } from "../live-supabase.mjs";
import { analyzeMigrations } from "./analyze.mjs";
import { buildApplyOrder } from "./repair-plan.mjs";
import { getLiveTables, getLiveColumns, getOrphanBusinessIdCounts } from "./introspect-schema.mjs";

// Bilinen production proje ref'i. Bu, "linked proje production mı" kontrolünün
// otomatik olarak yanıtlanabilmesi için burada AÇIKÇA sabitlenmiştir — amaç,
// bu değeri gizlemek değil, tam tersine görünür ve denetlenebilir kılmaktır.
// Farklı bir Supabase organizasyonunda/projede kullanılırsa PRODUCTION_PROJECT_REF
// ortam değişkeniyle override edilebilir.
export const KNOWN_PRODUCTION_REF = "acakggrzkrnmiunxijwm";

function getConfiguredProductionRef() {
  return String(process.env.PRODUCTION_PROJECT_REF || KNOWN_PRODUCTION_REF).trim();
}

async function checkBackupTaken() {
  const markerPath = String(process.env.BACKUP_MARKER_PATH || "").trim();

  if (!markerPath) {
    return {
      name: "Backup alındı mı",
      status: "manual",
      detail:
        "Otomatik olarak doğrulanamaz. BACKUP_MARKER_PATH ortam değişkeni tanımlı değil. Migration'a başlamadan önce manuel bir pg_dump/snapshot alındığını elle onaylayın.",
    };
  }

  if (!existsSync(markerPath)) {
    return {
      name: "Backup alındı mı",
      status: "fail",
      detail: `BACKUP_MARKER_PATH (${markerPath}) tanımlı ama dosya bulunamadı.`,
    };
  }

  const stats = statSync(markerPath);
  const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

  if (ageHours > 24) {
    return {
      name: "Backup alındı mı",
      status: "fail",
      detail: `Backup dosyası var ama ${ageHours.toFixed(1)} saat önce oluşturulmuş (24 saatten eski). Yeni bir backup alın.`,
    };
  }

  return {
    name: "Backup alındı mı",
    status: "pass",
    detail: `Backup dosyası mevcut ve ${ageHours.toFixed(1)} saat önce oluşturulmuş.`,
  };
}

async function checkCloneEnvironmentAvailable() {
  const cli = getSupabaseCliCandidate();
  const branchesResult = runSupabase(["branches", "list", "--output", "json"], { cli });
  let branches = [];
  try {
    branches = JSON.parse(branchesResult.stdout || "[]");
  } catch {
    branches = [];
  }

  const projectsResult = runSupabase(["projects", "list", "--output", "json"], { cli });
  let projects = [];
  try {
    projects = JSON.parse(projectsResult.stdout || "[]");
  } catch {
    projects = [];
  }

  const productionRef = getConfiguredProductionRef();
  const otherActiveProjects = projects.filter(
    (project) => project.ref !== productionRef && project.status === "ACTIVE_HEALTHY",
  );

  if (Array.isArray(branches) && branches.length > 0) {
    return {
      name: "Clone/staging ortamı var mı",
      status: "pass",
      detail: `${branches.length} development/preview branch bulundu.`,
    };
  }

  if (otherActiveProjects.length > 0) {
    return {
      name: "Clone/staging ortamı var mı",
      status: "manual",
      detail: `Branch yok, ama organizasyonda production dışı ${otherActiveProjects.length} aktif proje var (${otherActiveProjects
        .map((p) => p.ref)
        .join(", ")}) — bunların transfer-all şemasıyla ilgisi olup olmadığını elle doğrulayın.`,
    };
  }

  return {
    name: "Clone/staging ortamı var mı",
    status: "fail",
    detail:
      "Ne development/preview branch ne de kullanılabilir başka bir aktif proje bulundu. Migration'a başlamadan önce bir clone/staging ortamı kurulmalı.",
  };
}

async function checkLinkedProjectIsProduction() {
  const cli = getSupabaseCliCandidate();
  const result = runSupabase(["projects", "list", "--output", "json"], { cli });
  let projects = [];
  try {
    projects = JSON.parse(result.stdout || "[]");
  } catch {
    projects = [];
  }

  const linkedProject = projects.find((project) => project.linked);
  const productionRef = getConfiguredProductionRef();
  const isProduction = linkedProject?.ref === productionRef;

  return {
    name: "Linked proje production mı",
    status: isProduction ? "warn_production" : linkedProject ? "pass" : "manual",
    detail: linkedProject
      ? `Linked proje ref: ${linkedProject.ref} (${linkedProject.name}). ${
          isProduction
            ? "BU PRODUCTION PROJESİ — buraya doğrudan migration uygulamak yüksek risklidir."
            : "Bilinen production ref'i ile eşleşmiyor."
        }`
      : "Linked proje tespit edilemedi.",
  };
}

async function checkSchemaDrift(dbUrl) {
  const results = await analyzeMigrations({ dbUrl });
  const drifted = results.filter((item) => item.status !== "applied" && item.status !== "unknown");

  return {
    name: "Schema drift var mı",
    status: drifted.length ? "fail" : "pass",
    detail: drifted.length
      ? `${drifted.length} migration "applied" değil: ${drifted.map((item) => `${item.version}(${item.status})`).join(", ")}`
      : "Tüm migration'lar (unknown hariç) applied görünüyor.",
    analysisResults: results,
  };
}

async function checkOrphanBusinessIds(dbUrl) {
  const liveTables = await getLiveTables(dbUrl);
  const liveColumns = await getLiveColumns(dbUrl);
  const tablesWithBusinessId = liveTables.filter(
    (table) => table !== "businesses" && liveColumns.get(table)?.has("business_id"),
  );

  const counts = await getOrphanBusinessIdCounts(dbUrl, tablesWithBusinessId);
  const orphanReports = Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .map(([table, count]) => ({ table, count }));

  return {
    name: "Orphan business_id var mı",
    status: orphanReports.length ? "fail" : "pass",
    detail: orphanReports.length
      ? `Orphan business_id bulunan tablolar: ${orphanReports.map((r) => `${r.table}(${r.count})`).join(", ")}`
      : `${tablesWithBusinessId.length} tablo kontrol edildi, orphan business_id bulunamadı.`,
  };
}

function checkMigrationDependencies(analysisResults) {
  const { order, unresolved } = buildApplyOrder(analysisResults);

  return {
    name: "Migration bağımlılıkları tamam mı",
    status: unresolved.length ? "fail" : "pass",
    detail: unresolved.length
      ? `Bağımlılığı çözülemeyen migration'lar: ${unresolved.join(", ")}`
      : `Uygulanacak ${order.length} migration için bağımlılık sırası hesaplanabildi: ${order.join(" -> ") || "(yok)"}`,
  };
}

export async function runPreMigrationValidator({ dbUrl } = {}) {
  const checks = [];

  checks.push(await checkBackupTaken());
  checks.push(await checkCloneEnvironmentAvailable());
  checks.push(await checkLinkedProjectIsProduction());

  const driftCheck = await checkSchemaDrift(dbUrl);
  checks.push(driftCheck);

  checks.push(await checkOrphanBusinessIds(dbUrl));
  checks.push(checkMigrationDependencies(driftCheck.analysisResults));

  const hasFailure = checks.some((check) => check.status === "fail" || check.status === "warn_production");
  const hasManual = checks.some((check) => check.status === "manual");

  return {
    checks,
    safeToProceed: !hasFailure && !hasManual,
    requiresManualConfirmation: hasManual,
  };
}

export function formatValidatorReport(result) {
  const symbolFor = (status) => {
    if (status === "pass") return "✓";
    if (status === "fail") return "✗";
    if (status === "warn_production") return "⛔";
    return "?"; // manual
  };

  const lines = ["Pre-Migration Validator (salt-okunur)", ""];
  for (const check of result.checks) {
    lines.push(`${symbolFor(check.status)} ${check.name}: ${check.status.toUpperCase()}`);
    lines.push(`    ${check.detail}`);
  }

  lines.push("");
  lines.push(
    result.safeToProceed
      ? "SONUÇ: Otomatik kontrollerin hepsi geçti. (Bu, migration'ın güvenli olduğu anlamına gelmez — yalnızca bu araçtaki kontrollerin geçtiği anlamına gelir.)"
      : "SONUÇ: Migration BAŞLAMAMALI. En az bir kontrol başarısız veya manuel onay gerektiriyor.",
  );

  return lines.join("\n");
}
