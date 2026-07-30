import { readFile } from "node:fs/promises";
import path from "node:path";
import { migrationDir, readLocalMigrationVersions } from "../live-supabase.mjs";

// Bu dosya bir genel-amaçlı SQL parser DEĞİLDİR. Bu repodaki 43 migration
// dosyasının GÖZLEMLENMİŞ, tutarlı yazım biçimlerine göre ayarlanmış, regex
// tabanlı bir "beyan edilen artifact" çıkarıcısıdır. Amaç: her migration
// dosyasının hangi tablo/kolon/enum-değeri/trigger/fonksiyon/index/tenant-RLS
// çağrısı/constraint "beyan ettiğini" statik olarak listelemek — bu çıktı,
// introspect-schema.mjs'in canlıdan okuduğu gerçek durumla karşılaştırılır.
// Yeni bir migration eklenirken burada tanınmayan sıra dışı bir SQL kalıbı
// kullanılırsa, o migration'ın ilgili artifact'i eksik/boş listelenebilir —
// bu bir "false missing" riski taşır, bu yüzden analyzer çıktısı her zaman
// "olası" (best-effort) bir sinyal olarak okunmalı, kesin gerçek olarak değil.

function stripComments(sql) {
  return sql.replace(/--[^\n]*$/gm, "");
}

export function extractTables(sql) {
  const tables = new Set();
  const re = /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?(\w+)/gi;
  let match;
  while ((match = re.exec(sql))) {
    tables.add(match[1]);
  }
  return Array.from(tables);
}

export function extractColumns(sql) {
  const columns = [];
  const re = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)\s+([\s\S]*?);/gi;
  let match;
  while ((match = re.exec(sql))) {
    const table = match[1];
    const block = match[2];
    const colRe = /add\s+column\s+if\s+not\s+exists\s+(\w+)/gi;
    let colMatch;
    while ((colMatch = colRe.exec(block))) {
      columns.push({ table, column: colMatch[1] });
    }
  }
  return columns;
}

export function extractAlterConstraints(sql) {
  const constraints = [];
  const re = /alter\s+table\s+(?:if\s+exists\s+)?(?:public\.)?(\w+)\s+([\s\S]*?);/gi;
  let match;
  while ((match = re.exec(sql))) {
    const table = match[1];
    const block = match[2];
    const constraintRe = /add\s+constraint\s+(\w+)\s+(check|unique|foreign\s+key)/gi;
    let constraintMatch;
    while ((constraintMatch = constraintRe.exec(block))) {
      const kind = constraintMatch[2].toLowerCase().startsWith("check")
        ? "check"
        : constraintMatch[2].toLowerCase().startsWith("unique")
          ? "unique"
          : "foreign_key";
      constraints.push({ table, name: constraintMatch[1], kind });
    }
  }
  return constraints;
}

export function extractInlineTableConstraints(sql) {
  // create table içindeki satır-içi "constraint X check(...)" tanımları.
  const constraints = [];
  const re = /constraint\s+(\w+)\s+check\s*\(/gi;
  let match;
  while ((match = re.exec(sql))) {
    constraints.push({ name: match[1], kind: "check" });
  }
  return constraints;
}

export function extractEnumValues(sql) {
  const values = [];
  const re = /alter\s+type\s+(?:public\.)?(\w+)\s+add\s+value\s+if\s+not\s+exists\s+'(\w+)'/gi;
  let match;
  while ((match = re.exec(sql))) {
    values.push({ type: match[1], value: match[2] });
  }
  return values;
}

export function extractTriggers(sql) {
  const triggers = [];
  const re = /create\s+trigger\s+(\w+)[\s\S]*?on\s+(?:public\.)?(\w+)/gi;
  let match;
  while ((match = re.exec(sql))) {
    triggers.push({ name: match[1], table: match[2] });
  }
  return triggers;
}

export function extractFunctions(sql) {
  const functions = new Set();
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)/gi;
  let match;
  while ((match = re.exec(sql))) {
    functions.add(match[1]);
  }
  return Array.from(functions);
}

export function extractIndexes(sql) {
  const indexes = [];
  const re = /create\s+(unique\s+)?index\s+if\s+not\s+exists\s+(\w+)\s+on\s+(?:public\.)?(\w+)/gi;
  let match;
  while ((match = re.exec(sql))) {
    indexes.push({ name: match[2], table: match[3], unique: Boolean(match[1]) });
  }
  return indexes;
}

export function extractTenantRlsCalls(sql) {
  const calls = [];
  const re = /apply_(uuid|text)_tenant_rls\(\s*'(?:public\.)?(\w+)'::regclass\s*\)/gi;
  let match;
  while ((match = re.exec(sql))) {
    calls.push({ kind: match[1], table: match[2] });
  }
  return calls;
}

// Bir tenant-RLS çağrısının, 0041'deki apply_uuid_tenant_rls/apply_text_tenant_rls
// fonksiyonlarının ürettiği DÖRT politika adını (select/insert/update/delete)
// önceden hesaplar. Bu politikalar dosyada literal olarak yazılı değildir
// (fonksiyon içinde `format()` ile dinamik üretilir), bu yüzden statik regex ile
// bulunamazlar — bu fonksiyon onları TÜRETİR.
export function derivePolicyNamesForTenantRlsCall(table) {
  const prefix = table.replace(/\./g, "_");
  return [
    `${prefix}_select_tenant`,
    `${prefix}_insert_tenant`,
    `${prefix}_update_tenant`,
    `${prefix}_delete_tenant`,
  ];
}

export async function parseMigrationFile(fileName) {
  const raw = await readFile(path.join(migrationDir, fileName), "utf8");
  const sql = stripComments(raw);

  // extractAlterConstraints ve extractInlineTableConstraints bazı durumlarda aynı
  // "add constraint X check(...)" ifadesini iki farklı desenle yakalayabiliyor;
  // isme göre dedupe ederek tek kayda indiriyoruz.
  const seenConstraintNames = new Set();
  const constraints = [...extractAlterConstraints(sql), ...extractInlineTableConstraints(sql)].filter(
    (item) => {
      if (seenConstraintNames.has(item.name)) {
        return false;
      }
      seenConstraintNames.add(item.name);
      return true;
    },
  );

  return {
    file: fileName,
    tables: extractTables(sql),
    columns: extractColumns(sql),
    enumValues: extractEnumValues(sql),
    triggers: extractTriggers(sql),
    functions: extractFunctions(sql),
    indexes: extractIndexes(sql),
    tenantRlsCalls: extractTenantRlsCalls(sql),
    constraints,
  };
}

export async function parseAllMigrations() {
  const { versions } = await readLocalMigrationVersions();
  const parsed = [];
  for (const item of versions) {
    parsed.push({ version: item.version, ...(await parseMigrationFile(item.name)) });
  }
  return parsed;
}
