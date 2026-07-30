// Bu modül YALNIZCA metin/plan üretir. Hiçbir "supabase migration repair",
// "db push" veya DDL komutu ÇALIŞTIRMAZ — yalnızca analyze.mjs'in salt-okunur
// sonuçlarına bakarak insan tarafından uygulanacak/onaylanacak bir plan yazar.

function describeMissingItems(details) {
  const lines = [];

  const missingTables = details.tables.filter((i) => !i.present);
  if (missingTables.length) {
    lines.push(`  - Eksik tablo: ${missingTables.map((i) => i.table).join(", ")}`);
  }

  const missingColumns = details.columns.filter((i) => !i.present);
  if (missingColumns.length) {
    lines.push(`  - Eksik kolon: ${missingColumns.map((i) => `${i.table}.${i.column}`).join(", ")}`);
  }

  const missingEnums = details.enumValues.filter((i) => !i.present);
  if (missingEnums.length) {
    lines.push(`  - Eksik enum değeri: ${missingEnums.map((i) => `${i.type}.${i.value}`).join(", ")}`);
  }

  const missingTriggers = details.triggers.filter((i) => !i.present);
  if (missingTriggers.length) {
    lines.push(`  - Eksik trigger: ${missingTriggers.map((i) => i.name).join(", ")}`);
  }

  const missingFunctions = details.functions.filter((i) => !i.present);
  if (missingFunctions.length) {
    lines.push(`  - Eksik fonksiyon: ${missingFunctions.map((i) => i.name).join(", ")}`);
  }

  const missingIndexes = details.indexes.filter((i) => !i.present);
  if (missingIndexes.length) {
    lines.push(`  - Eksik index: ${missingIndexes.map((i) => i.name).join(", ")}`);
  }

  const missingConstraints = details.constraints.filter((i) => !i.present);
  if (missingConstraints.length) {
    lines.push(`  - Eksik constraint: ${missingConstraints.map((i) => i.name).join(", ")}`);
  }

  const missingPolicies = details.policies.filter((i) => !i.present);
  if (missingPolicies.length) {
    lines.push(
      `  - Eksik policy: ${missingPolicies.length} adet (${Array.from(
        new Set(missingPolicies.map((i) => i.table)),
      ).join(", ")} tabloları için tenant RLS politikaları)`,
    );
  }

  return lines;
}

export function buildRepairPlan(analysisResults) {
  const byVersion = new Map(analysisResults.map((item) => [item.version, item]));
  const plan = [];

  for (const result of analysisResults) {
    if (result.status === "applied") {
      plan.push({
        version: result.version,
        action: "mark_applied",
        summary: `Migration ${result.version}: şemada tam olarak mevcut. "applied" olarak işaretlenebilir (supabase migration repair ${result.version.padStart(4, "0")}... --status applied --linked). Bu bir ÖNERİDİR, bu araç repair komutunu ÇALIŞTIRMAZ.`,
        details: [],
        blockedBy: [],
      });
      continue;
    }

    if (result.status === "unknown") {
      plan.push({
        version: result.version,
        action: "manual_review",
        summary: `Migration ${result.version}: bu dosyada izlenen türde (tablo/kolon/enum/trigger/fonksiyon/index/constraint/policy) bir DDL beyanı bulunamadı — muhtemelen yalnızca veri güncellemesi (UPDATE) veya bu analizörün tanımadığı bir SQL kalıbı içeriyor. Otomatik olarak "applied"/"missing" olarak sınıflandırılamaz, dosyayı elle inceleyin.`,
        details: [],
        blockedBy: [],
      });
      continue;
    }

    const unmetDependencies = result.dependsOn.filter((dep) => {
      const depResult = byVersion.get(dep);
      return depResult && depResult.status !== "applied";
    });

    const details = describeMissingItems(result.details);

    let action;
    let summary;

    if (result.status === "partial") {
      action = "complete_then_mark";
      summary = `Migration ${result.version}: KISMEN uygulanmış. Önce eksik parçaları tamamlayan dar kapsamlı, izole bir düzeltme migration'ı yazılmalı; TÜM parçalar mevcut hale geldikten sonra "applied" olarak işaretlenmeli. Dosyanın tamamını olduğu gibi yeniden çalıştırmak güvenli olmayabilir (mevcut parçalar için "if not exists" koruması olsa da, migration'ın orijinal sırası/varsayımları bozulmuş olabilir).`;
    } else {
      action = unmetDependencies.length ? "blocked" : "apply_directly";
      summary = unmetDependencies.length
        ? `Migration ${result.version}: hiç uygulanmamış VE bağımlılıkları henüz karşılanmamış. Önce şu migration'lar tamamlanmalı: ${unmetDependencies.join(", ")}.`
        : `Migration ${result.version}: hiç uygulanmamış, ama tüm bağımlılıkları karşılanmış görünüyor. Doğrudan (clone/staging üzerinde önce) uygulanabilir.`;
    }

    plan.push({
      version: result.version,
      action,
      summary,
      details,
      blockedBy: unmetDependencies,
    });
  }

  return plan;
}

export function formatRepairPlan(plan) {
  const lines = ["Migration Repair Plan (yalnızca öneri — hiçbir komut çalıştırılmadı)", ""];

  for (const item of plan) {
    lines.push(`Migration ${item.version} [${item.action}]`);
    lines.push(`  ${item.summary}`);
    for (const detail of item.details) {
      lines.push(detail);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Uygulama sırası önerisi: yalnızca "missing" veya "partial" olan, bağımlılığı
// karşılanmış (ya da bağımlılığı da bu listede kendinden önce gelen) migration'ları
// bağımlılık grafiğine göre topolojik olarak sıralar.
export function buildApplyOrder(analysisResults) {
  const pending = analysisResults.filter((item) => item.status === "missing" || item.status === "partial");
  const byVersion = new Map(analysisResults.map((item) => [item.version, item]));
  const ordered = [];
  const placed = new Set(
    analysisResults.filter((item) => item.status === "applied").map((item) => item.version),
  );
  // Sürüm numarasına göre artan sırada işlenir ki (gerçek bağımlılıklar izin
  // verdiği sürece) çıktı, insan gözüyle okunması en doğal olan "0001, 0002, ..."
  // sırasına mümkün olduğunca yakın kalsın; yalnızca gerçek bir bağımlılık
  // zorladığında sıra bundan sapsın.
  const remaining = [...pending].sort((left, right) => left.version.localeCompare(right.version));

  let progress = true;
  while (remaining.length && progress) {
    progress = false;
    for (let i = 0; i < remaining.length; i += 1) {
      const item = remaining[i];
      const ready = item.dependsOn.every((dep) => placed.has(dep) || !byVersion.has(dep));
      if (ready) {
        ordered.push(item.version);
        placed.add(item.version);
        remaining.splice(i, 1);
        progress = true;
        break;
      }
    }
  }

  // Kalan varsa (döngüsel bağımlılık ya da çözülemeyen bağımlılık) — bunları da
  // listeye ekle ama işaretle, sessizce atlama.
  const unresolved = remaining.map((item) => item.version);

  return { order: ordered, unresolved };
}
