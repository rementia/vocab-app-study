import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { auditMultipleChoiceQuality } from "../multipleChoiceQualityAudit.js";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const normalized = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((cols) => cols.some((value) => String(value ?? "").trim() !== ""));
}

function rowsToWords(rows) {
  if (rows.length === 0) return [];
  const headers = rows[0].map((value) => String(value ?? "").trim());
  const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  const required = ["id", "word", "meaning", "level", "partOfSpeech", "semanticCategory"];
  required.forEach((header) => {
    if (!(header in index)) throw new Error(`必須列がありません: ${header}`);
  });

  return rows.slice(1)
    .map((cols) => {
      const level = String(cols[index.level] ?? "").trim();
      return {
        id: String(cols[index.id] ?? "").trim(),
        word: String(cols[index.word] ?? "").trim(),
        meaning: String(cols[index.meaning] ?? "").trim(),
        sourceVol: level ? `vol${level}` : "",
        partOfSpeech: String(cols[index.partOfSpeech] ?? "").trim(),
        semanticCategory: String(cols[index.semanticCategory] ?? "").trim()
      };
    })
    .filter((item) => item.word);
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npm run audit:quality -- /path/to/vocab-app-study.csv");
  process.exit(2);
}

const absolutePath = path.resolve(csvPath);
const words = rowsToWords(parseCsv(fs.readFileSync(absolutePath, "utf8")));
const report = auditMultipleChoiceQuality(words);

console.log(JSON.stringify({
  file: absolutePath,
  totalWords: report.totalWords,
  formatReadyCount: report.formatReadyCount,
  formatFallbackCount: report.formatFallbackCount,
  sameVolTopTierInsufficientCount: report.sameVolTopTierInsufficientCount,
  duplicateMeaningGroupCount: report.duplicateMeaningGroupCount,
  formatFallbackExamples: report.formatFallback.slice(0, 20),
  sameVolTopTierInsufficientExamples: report.sameVolTopTierInsufficient.slice(0, 20),
  duplicateMeaningExamples: report.duplicateMeanings.slice(0, 20)
}, null, 2));

console.log("Vocabulary quality audit completed (advisory report; no automatic data mutation).");
