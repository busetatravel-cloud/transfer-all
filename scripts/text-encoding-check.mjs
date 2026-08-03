import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Salt-okunur. Hiçbir dosyayı değiştirmez, hiçbir DB/network çağrısı yapmaz.
// Yalnızca kaynak kodda bilinen mojibake (UTF-8 baytlarının Latin-1/Windows-1252
// olarak yanlış çözümlenmesiyle oluşan bozuk metin) kalıplarını arar ve raporlar.
// CI'da kullanmak için: yüksek güvenilirlikli bulgu varsa exit code 1 döner.
//
// Tüm kalıplar, kaynak dosyanın kendisinde yanlışlıkla bozuk karakter
// taşıma riskini sıfırlamak için \uXXXX unicode kaçış dizileriyle
// tanımlanmıştır — hiçbir mojibake karakteri bu dosyada literal olarak
// yazılmamıştır.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const allowlistPath = path.join(repoRoot, "scripts", "text-encoding-allowlist.json");

const SCAN_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".sql",
  ".md",
  ".mdx",
  ".css",
  ".html",
]);

const EXCLUDED_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  ".git",
  "tmp",
  "out",
  "build",
  "coverage",
  ".vercel",
]);

// Bu yollar (repo köküne göre, / ile) tamamen tarama dışı bırakılır.
const EXCLUDED_PATH_PREFIXES = ["supabase/snapshots", "supabase/.branches", "supabase/.temp"];

function bigram(first, second) {
  return new RegExp(`\\u${first.toString(16).padStart(4, "0")}\\u${second.toString(16).padStart(4, "0")}`, "g");
}

// Yüksek güvenilirlikli mojibake imzaları — Türkçe/Almanca/genel Latin
// karakterlerin UTF-8 baytlarının Windows-1252 olarak yanlış çözümlenmesiyle
// oluşan, gerçek dilde pratikte hiç rastlanmayan karakter ikilileri.
const HIGH_CONFIDENCE_PATTERNS = [
  { name: "ö -> Ã¶", regex: bigram(0x00c3, 0x00b6) },
  { name: "ü -> Ã¼", regex: bigram(0x00c3, 0x00bc) },
  { name: "ç -> Ã§", regex: bigram(0x00c3, 0x00a7) },
  { name: "ä -> Ã¤", regex: bigram(0x00c3, 0x00a4) },
  { name: "é -> Ã©", regex: bigram(0x00c3, 0x00a9) },
  { name: "è -> Ã¨", regex: bigram(0x00c3, 0x00a8) },
  { name: "ñ -> Ã±", regex: bigram(0x00c3, 0x00b1) },
  { name: "Ö -> Ã + en-dash", regex: bigram(0x00c3, 0x2013) },
  { name: "Ç -> Ã + dagger", regex: bigram(0x00c3, 0x2020) },
  { name: "Ü -> Ã + oe-ligature", regex: bigram(0x00c3, 0x0153) },
  { name: "Ñ -> Ã + left-quote", regex: bigram(0x00c3, 0x2018) },
  { name: "ı -> Ä±", regex: bigram(0x00c4, 0x00b1) },
  { name: "İ -> Ä°", regex: bigram(0x00c4, 0x00b0) },
  { name: "ğ -> Ä + Ÿ", regex: bigram(0x00c4, 0x0178) },
  { name: "Ğ -> Ä + ž", regex: bigram(0x00c4, 0x017e) },
  { name: "ş -> Å + Ÿ", regex: bigram(0x00c5, 0x0178) },
  { name: "Ş -> Å + ž", regex: bigram(0x00c5, 0x017e) },
  { name: "unicode replacement character", regex: /�/g },
];

// Daha düşük güvenilirlikli kalıplar — tek başlarına bulunduklarında başka
// dillerde (Portekizce Ã, İskandinav Å/Ä, vb.) meşru olabilirler. Yalnızca
// "review" olarak raporlanır, exit code'u tek başına 1 yapmaz.
const REVIEW_PATTERNS = [
  { name: "olası mojibake ailesi (â€...)", regex: bigram(0x00e2, 0x20ac) },
  { name: "tek başına Ã", regex: /Ã(?![-ÿĀ-ɏ])/g },
  { name: "tek başına Â", regex: /Â(?![-ÿĀ-ɏ])/g },
];

async function loadAllowlist() {
  if (!existsSync(allowlistPath)) {
    return new Set();
  }

  try {
    const raw = await readFile(allowlistPath, "utf8");
    const parsed = JSON.parse(raw);
    const files = Array.isArray(parsed.files) ? parsed.files : [];
    return new Set(files.map((f) => String(f).replace(/\\/g, "/")));
  } catch (error) {
    console.error(
      `UYARI: allowlist dosyası (${allowlistPath}) okunamadı/parse edilemedi, allowlist boş kabul ediliyor. Hata: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return new Set();
  }
}

function isExcludedDir(name) {
  return EXCLUDED_DIR_NAMES.has(name) || name.startsWith(".");
}

async function walk(dir, relBase, files) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = path.join(relBase, entry.name).replace(/\\/g, "/");

    if (EXCLUDED_PATH_PREFIXES.some((prefix) => relPath === prefix || relPath.startsWith(`${prefix}/`))) {
      continue;
    }

    if (entry.isDirectory()) {
      if (isExcludedDir(entry.name)) {
        continue;
      }
      await walk(path.join(dir, entry.name), relPath, files);
      continue;
    }

    if (entry.isFile() && SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relPath);
    }
  }
}

function findMatches(content, patterns) {
  const hits = [];
  const lines = content.split(/\r\n|\r|\n/);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        hits.push({
          line: lineIndex + 1,
          pattern: pattern.name,
          snippet: line.trim().slice(0, 160),
        });
      }
    }
  }

  return hits;
}

async function main() {
  const allowlist = await loadAllowlist();
  const files = [];
  await walk(repoRoot, "", files);

  const highConfidenceFindings = [];
  const reviewFindings = [];
  let skippedAllowlisted = 0;

  for (const relPath of files) {
    if (allowlist.has(relPath)) {
      skippedAllowlisted += 1;
      continue;
    }

    const absPath = path.join(repoRoot, relPath);
    let content;
    try {
      content = await readFile(absPath, "utf8");
    } catch {
      continue;
    }

    const highHits = findMatches(content, HIGH_CONFIDENCE_PATTERNS);
    if (highHits.length) {
      highConfidenceFindings.push({ file: relPath, hits: highHits });
    }

    const reviewHits = findMatches(content, REVIEW_PATTERNS);
    if (reviewHits.length) {
      reviewFindings.push({ file: relPath, hits: reviewHits });
    }
  }

  console.log("Text Encoding Check (salt-okunur, hiçbir dosya değiştirilmedi)");
  console.log(`Taranan dosya: ${files.length}, allowlist ile atlanan: ${skippedAllowlisted}`);
  console.log("");

  if (highConfidenceFindings.length === 0) {
    console.log("OK  Yüksek güvenilirlikli mojibake kalıbı bulunamadı.");
  } else {
    console.log(`FAIL  ${highConfidenceFindings.length} dosyada yüksek güvenilirlikli mojibake bulundu:`);
    for (const finding of highConfidenceFindings) {
      console.log(`  ${finding.file}`);
      for (const hit of finding.hits) {
        console.log(`    L${hit.line} [${hit.pattern}]: ${hit.snippet}`);
      }
    }
  }

  console.log("");

  if (reviewFindings.length === 0) {
    console.log("OK  İncelenmesi gereken (düşük güvenilirlikli) karakter bulunamadı.");
  } else {
    console.log(
      `INFO  ${reviewFindings.length} dosyada incelenmesi gereken (düşük güvenilirlikli) karakter bulundu — başka dillerde meşru olabilir, elle kontrol edin:`,
    );
    for (const finding of reviewFindings) {
      console.log(`  ${finding.file}`);
      for (const hit of finding.hits) {
        console.log(`    L${hit.line} [${hit.pattern}]: ${hit.snippet}`);
      }
    }
  }

  if (highConfidenceFindings.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
