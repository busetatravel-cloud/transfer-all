import { parseAllMigrations, derivePolicyNamesForTenantRlsCall } from "./parse-migrations.mjs";
import {
  getLiveTables,
  getLiveColumns,
  getLiveEnumValues,
  getLiveTriggers,
  getLiveFunctions,
  getLiveIndexes,
  getLiveConstraints,
  getLivePolicies,
} from "./introspect-schema.mjs";

// Bu modül HİÇBİR ZAMAN şema değiştirmez — yalnızca introspect-schema.mjs'in
// (salt-okunur) okuduğu canlı durumla parse-migrations.mjs'in (statik) okuduğu
// yerel migration beyanlarını karşılaştırır.

export async function analyzeMigrations({ dbUrl } = {}) {
  const parsedMigrations = await parseAllMigrations();

  const [liveTables, liveColumns, liveEnums, liveTriggers, liveFunctions, liveIndexes, liveConstraints, livePolicies] =
    await Promise.all([
      getLiveTables(dbUrl),
      getLiveColumns(dbUrl),
      getLiveEnumValues(dbUrl),
      getLiveTriggers(dbUrl),
      getLiveFunctions(dbUrl),
      getLiveIndexes(dbUrl),
      getLiveConstraints(dbUrl),
      getLivePolicies(dbUrl),
    ]);

  const liveTableSet = new Set(liveTables);

  // Her tabloyu ilk yaratan migration'ı ve her fonksiyonu ilk tanımlayan migration'ı
  // bulup bir "sahiplik" haritası çıkarır. Bu, repair-plan.mjs'in bağımlılıkları
  // ELLE YAZILMIŞ bir listeye değil, migration dosyalarının GERÇEK içeriğine bakarak
  // otomatik türetmesini sağlar.
  const tableOwner = new Map();
  const functionOwner = new Map();
  for (const migration of parsedMigrations) {
    for (const table of migration.tables) {
      if (!tableOwner.has(table)) {
        tableOwner.set(table, migration.version);
      }
    }
    for (const fn of migration.functions) {
      if (!functionOwner.has(fn)) {
        functionOwner.set(fn, migration.version);
      }
    }
  }

  const results = [];

  for (const migration of parsedMigrations) {
    const details = {
      tables: [],
      columns: [],
      enumValues: [],
      triggers: [],
      functions: [],
      indexes: [],
      constraints: [],
      policies: [],
    };
    let totalChecks = 0;
    let presentChecks = 0;
    const dependsOn = new Set();

    for (const table of migration.tables) {
      totalChecks += 1;
      const present = liveTableSet.has(table);
      if (present) presentChecks += 1;
      details.tables.push({ table, present });
    }

    for (const { table, column } of migration.columns) {
      totalChecks += 1;
      const present = liveColumns.get(table)?.has(column) ?? false;
      if (present) presentChecks += 1;
      details.columns.push({ table, column, present });

      const owner = tableOwner.get(table);
      if (owner && owner !== migration.version) {
        dependsOn.add(owner);
      }
    }

    for (const { type, value } of migration.enumValues) {
      totalChecks += 1;
      const present = liveEnums.get(type)?.has(value) ?? false;
      if (present) presentChecks += 1;
      details.enumValues.push({ type, value, present });
    }

    for (const { name, table } of migration.triggers) {
      totalChecks += 1;
      const present = liveTriggers.has(name);
      if (present) presentChecks += 1;
      details.triggers.push({ name, table, present });
    }

    for (const name of migration.functions) {
      totalChecks += 1;
      const present = liveFunctions.has(name);
      if (present) presentChecks += 1;
      details.functions.push({ name, present });
    }

    for (const { name, table } of migration.indexes) {
      totalChecks += 1;
      const present = liveIndexes.has(name);
      if (present) presentChecks += 1;
      details.indexes.push({ name, table, present });
    }

    for (const { name, table, kind } of migration.constraints) {
      totalChecks += 1;
      const present = liveConstraints.has(name);
      if (present) presentChecks += 1;
      details.constraints.push({ name, table, kind, present });

      if (table) {
        const owner = tableOwner.get(table);
        if (owner && owner !== migration.version) {
          dependsOn.add(owner);
        }
      }
    }

    for (const { kind, table } of migration.tenantRlsCalls) {
      const policyNames = derivePolicyNamesForTenantRlsCall(table);
      for (const policyName of policyNames) {
        totalChecks += 1;
        const present = livePolicies.has(policyName);
        if (present) presentChecks += 1;
        details.policies.push({ policyName, table, kind, present });
      }

      const owner = tableOwner.get(table);
      if (owner && owner !== migration.version) {
        dependsOn.add(owner);
      }

      // apply_uuid_tenant_rls/apply_text_tenant_rls fonksiyonlarının kendisi de
      // bir bağımlılıktır (genelde 0041'in kendisi tanımlar, bu yüzden kendine
      // bağımlılık oluşmaz — ama ileride bu fonksiyon başka bir migration'a
      // taşınırsa bu satır otomatik doğru bağımlılığı bulur).
      const rlsFunctionName = kind === "uuid" ? "apply_uuid_tenant_rls" : "apply_text_tenant_rls";
      const fnOwner = functionOwner.get(rlsFunctionName);
      if (fnOwner && fnOwner !== migration.version) {
        dependsOn.add(fnOwner);
      }
    }

    let status;
    if (totalChecks === 0) {
      status = "unknown";
    } else if (presentChecks === totalChecks) {
      status = "applied";
    } else if (presentChecks === 0) {
      status = "missing";
    } else {
      status = "partial";
    }

    results.push({
      version: migration.version,
      file: migration.file,
      status,
      totalChecks,
      presentChecks,
      dependsOn: Array.from(dependsOn).sort(),
      details,
    });
  }

  return results;
}

export function statusSymbol(status) {
  if (status === "applied") return "✓"; // ✓
  if (status === "partial") return "△"; // △
  if (status === "missing") return "✗"; // ✗
  return "?";
}
