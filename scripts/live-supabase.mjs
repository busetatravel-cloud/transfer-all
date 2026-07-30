import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const currentFile = fileURLToPath(import.meta.url);
export const repoRoot = path.resolve(path.dirname(currentFile), "..");
export const migrationDir = path.join(repoRoot, "supabase", "migrations");
export const scriptDir = path.join(repoRoot, "supabase", "scripts");

const envFileCandidates = [".env.local", ".env"];

function stripQuotes(value) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

export function parseEnvFile(source) {
  const result = {};

  for (const line of String(source ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    result[key] = stripQuotes(rawValue);
  }

  return result;
}

export async function loadLocalEnv() {
  for (const fileName of envFileCandidates) {
    try {
      const raw = await readFile(path.join(repoRoot, fileName), "utf8");
      const parsed = parseEnvFile(raw);
      for (const [key, value] of Object.entries(parsed)) {
        if (!process.env[key] && value) {
          process.env[key] = value;
        }
      }
    } catch {
      // Best effort.
    }
  }
}

export function maskSecret(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }

  if (text.length <= 8) {
    return `${text.slice(0, 2)}***`;
  }

  return `${text.slice(0, 4)}***${text.slice(-4)}`;
}

export function getSupabaseCliCandidate() {
  const explicit = String(process.env.SUPABASE_CLI_PATH || "").trim();
  if (explicit) {
    return explicit;
  }

  const localCandidates = [
    path.join(repoRoot, "node_modules", ".bin", "supabase.cmd"),
    path.join(repoRoot, "node_modules", ".bin", "supabase"),
  ];

  for (const candidate of localCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return "supabase";
}

function quoteCmdArg(value) {
  const text = String(value ?? "");
  if (!text) {
    return '""';
  }

  if (!/[\s"&|<>^]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '\\"')}"`;
}

function buildWindowsCommand(command, args) {
  return [command, ...args].map((part) => quoteCmdArg(part)).join(" ");
}

export function cliLooksAvailable(cli = getSupabaseCliCandidate()) {
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", buildWindowsCommand(cli, ["--version"])], {
          cwd: repoRoot,
          shell: false,
          encoding: "utf8",
          windowsHide: true,
        })
      : spawnSync(cli, ["--version"], {
          cwd: repoRoot,
          shell: false,
          encoding: "utf8",
          windowsHide: true,
        });

  return result.status === 0;
}

export function runSupabase(args, options = {}) {
  const cli = options.cli ?? getSupabaseCliCandidate();
  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", buildWindowsCommand(cli, args)], {
          cwd: options.cwd ?? repoRoot,
          env: {
            ...process.env,
            ...(options.env ?? {}),
          },
          input: options.input,
          encoding: "utf8",
          shell: false,
          windowsHide: true,
          maxBuffer: 20 * 1024 * 1024,
        })
      : spawnSync(cli, args, {
          cwd: options.cwd ?? repoRoot,
          env: {
            ...process.env,
            ...(options.env ?? {}),
          },
          input: options.input,
          encoding: "utf8",
          shell: false,
          windowsHide: true,
          maxBuffer: 20 * 1024 * 1024,
        });

  return {
    status: result.status ?? 1,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error ?? null,
    signal: result.signal ?? null,
  };
}

export function extractVersion(name) {
  const match = String(name ?? "").match(/^(\d{4,})_/);
  return match ? match[1] : null;
}

// Bu proje iki farklı migration adlandırma biçimini aynı anda barındırıyor:
// - "sequential": proje-özel 4 haneli sayaç (0001, 0002, ..., 0043)
// - "timestamp": Supabase CLI'nin kendi varsayılan biçimi (YYYYMMDDHHMMSS, 14 hane)
// Bu ikisini AYNI sayısal boşluk-doldurma (gap-fill) mantığına sokmak felakete yol
// açar: bir "timestamp" versiyonu (örn. 20260729222943) en büyük sequential versiyonla
// (örn. 0043) aynı diziye girerse, aralarındaki "eksik sayı" taraması trilyonlarca
// adımlık bir döngüye dönüşür ve bellek taşmasına (OOM) neden olur.
export function isSequentialVersion(version) {
  return /^\d{4}$/.test(String(version ?? ""));
}

export function isTimestampVersion(version) {
  return /^\d{14}$/.test(String(version ?? ""));
}

// Gap-fill döngüsünün büyüklüğünü sınırlayan güvenlik tavanı. 4 haneli sequential
// versiyonlar için en kötü ihtimalle aralık 9999 olabilir; bu değer onun çok
// üzerinde ama "gelecekte beklenmeyen bir versiyon biçimi sızarsa bile OOM asla
// tekrarlanmasın" garantisini veriyor.
export const MAX_GAP_FILL_RANGE = 100000;

export async function readLocalMigrationVersions() {
  const entries = await readdir(migrationDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const versions = files
    .map((name) => ({ name, version: extractVersion(name) }))
    .filter((item) => item.version);

  return { files, versions };
}

function normalizeMigrationContent(source) {
  return String(source ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+$/gm, "").trim();
}

export async function analyzeLocalMigrationSet() {
  const { files, versions } = await readLocalMigrationVersions();
  const prefixMap = new Map();
  const numericVersions = [];
  const timestampVersions = [];
  const unrecognizedVersions = [];

  for (const item of versions) {
    const list = prefixMap.get(item.version) ?? [];
    list.push(item.name);
    prefixMap.set(item.version, list);

    // Yalnızca sequential (4 haneli) versiyonlar sayısal boşluk taramasına girer.
    // Timestamp (14 haneli) versiyonlar doğası gereği "ardışık" değildir (belirli
    // anları temsil ederler), bu yüzden aralarında "eksik numara" aramak hem
    // anlamsız hem de tehlikelidir (OOM kök nedeni).
    if (isSequentialVersion(item.version)) {
      const parsed = Number.parseInt(item.version, 10);
      if (Number.isFinite(parsed)) {
        numericVersions.push(parsed);
      }
    } else if (isTimestampVersion(item.version)) {
      timestampVersions.push(item.name);
    } else {
      unrecognizedVersions.push(item.name);
    }
  }

  const duplicatePrefixes = Array.from(prefixMap.entries())
    .filter(([, names]) => names.length > 1)
    .map(([version, names]) => ({ version, files: names }));

  const sortedUniqueVersions = Array.from(new Set(numericVersions)).sort((left, right) => left - right);
  const missingNumbers = [];
  let missingNumbersSkipped = false;
  if (sortedUniqueVersions.length > 0) {
    const rangeSize = sortedUniqueVersions[sortedUniqueVersions.length - 1] - sortedUniqueVersions[0];

    // Güvenlik tavanı: sequential versiyonlar için bile beklenmedik şekilde devasa
    // bir aralık oluşursa (örn. gelecekte yanlışlıkla eklenecek 5+ haneli bir dosya),
    // sonsuz/aşırı büyük bir döngüye girmek yerine taramayı atla ve durumu bildir.
    if (rangeSize > MAX_GAP_FILL_RANGE) {
      missingNumbersSkipped = true;
    } else {
      for (let current = sortedUniqueVersions[0]; current <= sortedUniqueVersions[sortedUniqueVersions.length - 1]; current += 1) {
        if (!sortedUniqueVersions.includes(current)) {
          missingNumbers.push(String(current).padStart(4, "0"));
        }
      }
    }
  }

  const versionOrderIssues = [];
  let previous = null;
  for (const item of versions) {
    if (!item.version) {
      continue;
    }

    if (previous && item.version < previous) {
      versionOrderIssues.push({
        previousVersion: previous,
        version: item.version,
        file: item.name,
      });
    }
    previous = item.version;
  }

  const contentMap = new Map();
  for (const fileName of files) {
    const raw = await readFile(path.join(migrationDir, fileName), "utf8");
    const hash = createHash("sha256").update(normalizeMigrationContent(raw)).digest("hex");
    const list = contentMap.get(hash) ?? [];
    list.push(fileName);
    contentMap.set(hash, list);
  }

  const duplicateContents = Array.from(contentMap.values())
    .filter((names) => names.length > 1)
    .map((groupFiles) => ({ files: groupFiles }));

  return {
    files,
    versions,
    duplicatePrefixes,
    versionOrderIssues,
    missingNumbers,
    missingNumbersSkipped,
    duplicateContents,
    timestampVersions,
    unrecognizedVersions,
  };
}

export function parseMigrationListOutput(output) {
  const local = [];
  const remote = [];
  const lines = String(output ?? "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("LOCAL") || trimmed.startsWith("REMOTE")) {
      continue;
    }

    const cells = line.split(/\u2502|\|/).map((cell) => cell.trim());
    const localCell = cells[0] ?? "";
    const remoteCell = cells[1] ?? "";
    const localMatch = localCell.match(/^(\d{14})$/);
    const remoteMatch = remoteCell.match(/^(\d{14})$/);

    if (localMatch) {
      local.push(localMatch[1]);
    }

    if (remoteMatch) {
      remote.push(remoteMatch[1]);
    }

    if (!localMatch && !remoteMatch) {
      const allMatches = trimmed.match(/\d{14}/g) ?? [];
      if (allMatches.length === 1) {
        if (trimmed.startsWith(allMatches[0])) {
          local.push(allMatches[0]);
        } else {
          remote.push(allMatches[0]);
        }
      } else if (allMatches.length >= 2) {
        local.push(allMatches[0]);
        remote.push(allMatches[1]);
      }
    }
  }

  return {
    local: Array.from(new Set(local)),
    remote: Array.from(new Set(remote)),
  };
}

export function analyzeMigrationStatus(localVersions, remoteVersions) {
  const localEntries = localVersions.map((item) => {
    if (typeof item === "string") {
      return { name: item, version: item };
    }

    return {
      name: String(item?.name ?? item?.version ?? ""),
      version: String(item?.version ?? "").trim(),
    };
  });

  const localSet = new Set(
    localEntries
      .map((item) => item.version)
      .filter((value) => /^\d{4,}$/.test(value)),
  );
  const remoteSet = new Set(remoteVersions);

  const localOnly = localEntries
    .map((item) => item.version)
    .filter((version) => /^\d{4,}$/.test(version) && !remoteSet.has(version));
  const remoteOnly = remoteVersions.filter((version) => !localSet.has(version));

  const orderIssues = [];
  const seen = new Map();
  let previousVersion = null;

  for (const { name, version } of localEntries) {
    if (!version) {
      continue;
    }

    const prior = seen.get(version);
    if (prior) {
      orderIssues.push({
        type: "duplicate_version",
        version,
        files: [prior, name],
      });
    } else {
      seen.set(version, name);
    }

    if (previousVersion && version <= previousVersion) {
      orderIssues.push({
        type: "non_increasing_order",
        previousVersion,
        version,
        file: name,
      });
    }

    previousVersion = version;
  }

  const trackedVersions = ["0037", "0038", "0039", "0040", "0041"];
  const tracked = trackedVersions.map((version) => ({
    version,
    local: localSet.has(version),
    remote: remoteSet.has(version),
    status:
      localSet.has(version) && remoteSet.has(version)
        ? "synced"
        : localSet.has(version)
          ? "local_only"
          : remoteSet.has(version)
            ? "remote_only"
            : "missing",
  }));

  return {
    localOnly,
    remoteOnly,
    orderIssues,
    tracked,
  };
}

export function formatLocalMigrationIssues(localReport) {
  const lines = [];

  if (localReport.duplicatePrefixes.length) {
    lines.push("Duplicate migration prefixes:");
    for (const item of localReport.duplicatePrefixes) {
      lines.push(`- ${item.version}: ${item.files.join(", ")}`);
    }
  } else {
    lines.push("Duplicate migration prefixes: none");
  }

  if (localReport.versionOrderIssues.length) {
    lines.push("Migration order issues:");
    for (const issue of localReport.versionOrderIssues) {
      lines.push(`- ${issue.previousVersion} -> ${issue.version} in ${issue.file}`);
    }
  } else {
    lines.push("Migration order issues: none");
  }

  if (localReport.missingNumbers.length) {
    lines.push(`Missing migration numbers: ${localReport.missingNumbers.join(", ")}`);
  } else {
    lines.push("Missing migration numbers: none");
  }

  if (localReport.duplicateContents.length) {
    lines.push("Duplicate SQL content groups:");
    for (const group of localReport.duplicateContents) {
      lines.push(`- ${group.files.join(", ")}`);
    }
  } else {
    lines.push("Duplicate SQL content groups: none");
  }

  return lines.join("\n");
}

export function formatStatusReport(report) {
  const lines = [];

  lines.push("Migration status report");
  lines.push(`Local only: ${report.localOnly.length ? report.localOnly.join(", ") : "none"}`);
  lines.push(`Remote only: ${report.remoteOnly.length ? report.remoteOnly.join(", ") : "none"}`);

  if (report.orderIssues.length) {
    lines.push("Order issues:");
    for (const issue of report.orderIssues) {
      if (issue.type === "duplicate_version") {
        lines.push(`- duplicate version ${issue.version} in ${issue.files.join(" / ")}`);
      } else {
        lines.push(`- non-increasing version ${issue.previousVersion} -> ${issue.version} in ${issue.file}`);
      }
    }
  } else {
    lines.push("Order issues: none");
  }

  lines.push("Tracked migrations:");
  for (const item of report.tracked) {
    lines.push(`- ${item.version}: ${item.status}`);
  }

  return lines.join("\n");
}

export function parseJsonIfPossible(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function parseTableRows(output) {
  const rows = [];
  const lines = String(output ?? "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("schema") || trimmed.startsWith("schema_table")) {
      continue;
    }

    if (!/[\u2502|]/.test(line)) {
      continue;
    }

    const cells = line.split(/\u2502|\|/).map((cell) => cell.trim());
    if (!cells[0]) {
      continue;
    }

    rows.push(cells);
  }

  return rows;
}

export async function runSupabaseSql({ sql, dbUrl, linked = true, label = "query" }) {
  const tempFile = path.join(path.join(path.dirname(currentFile), ".."), "tmp", `transfer-all-${label}-${Date.now()}.sql`);
  const fileSql = String(sql ?? "").trim();

  if (!fileSql) {
    throw new Error("SQL payload is empty.");
  }

  const fs = await import("node:fs/promises");
  await fs.mkdir(path.dirname(tempFile), { recursive: true });

  const fileArgs = ["--output", "json", "db", "query"];
  if (linked) {
    fileArgs.push("--linked");
  }
  if (dbUrl) {
    fileArgs.push("--db-url", dbUrl);
  }

  const attempts = [
    { args: [...fileArgs, "--file", tempFile], useTempFile: true },
    { args: [...fileArgs], useStdin: true },
  ];

  for (const attempt of attempts) {
    if (attempt.useTempFile) {
      await fs.writeFile(tempFile, fileSql, "utf8");
    }

    const result = runSupabase(attempt.args, {
      input: attempt.useStdin ? fileSql : undefined,
    });

    if (result.status === 0) {
      try {
        await fs.unlink(tempFile);
      } catch {
        // ignore cleanup errors
      }
      return result;
    }
  }

  try {
    await fs.unlink(tempFile);
  } catch {
    // ignore cleanup errors
  }

  throw new Error(`Supabase SQL query failed. SQL label: ${label}`);
}

export function assertConfirmProduction(argv = process.argv.slice(2)) {
  if (!argv.includes("--confirm-production")) {
    throw new Error("Production target confirmation missing. Re-run with --confirm-production.");
  }
}

export function getDbTargetArgs({ dbUrl, linked = true } = {}) {
  if (dbUrl) {
    return ["--db-url", dbUrl];
  }

  return linked ? ["--linked"] : [];
}
