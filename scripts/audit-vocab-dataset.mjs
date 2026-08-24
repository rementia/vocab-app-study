import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { auditMultipleChoiceDataset } from "../multipleChoiceDatasetAudit.js";

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
  for (const header of required) {
    if (!(header in index)) throw new Error(`必須列がありません: ${header}`);
  }

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
    .filter((item) => Object.values(item).some((value) => String(value ?? "").trim() !== ""));
}

function hardFailureCount(report) {
  return (
    report.invalidRows.length +
    report.duplicateIds.length +
    report.duplicateWords.length +
    report.invalidPartsOfSpeech.length +
    report.invalidVolumes.length +
    report.directions.wordToMeaning.insufficient.length +
    report.directions.meaningToWord.insufficient.length +
    report.directions.wordToMeaning.priority3Required.length +
    report.directions.meaningToWord.priority3Required.length
  );
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: npm run audit:vocab -- /path/to/vocab-app-study.csv");
  process.exit(2);
}

const absolutePath = path.resolve(csvPath);
const words = rowsToWords(parseCsv(fs.readFileSync(absolutePath, "utf8")));
const report = auditMultipleChoiceDataset(words);

console.log(JSON.stringify({
  file: absolutePath,
  totalWords: report.totalWords,
  wordToMeaningTierCounts: report.directions.wordToMeaning.tierCounts,
  meaningToWordTierCounts: report.directions.meaningToWord.tierCounts,
  invalidRows: report.invalidRows.length,
  duplicateIds: report.duplicateIds.length,
  duplicateWords: report.duplicateWords.length,
  invalidPartsOfSpeech: report.invalidPartsOfSpeech.length,
  invalidVolumes: report.invalidVolumes.length,
  partOfSpeechReviewWarnings: report.partOfSpeechMismatches.length,
  wordToMeaningInsufficient: report.directions.wordToMeaning.insufficient.length,
  meaningToWordInsufficient: report.directions.meaningToWord.insufficient.length,
  wordToMeaningPriority3Required: report.directions.wordToMeaning.priority3Required.length,
  meaningToWordPriority3Required: report.directions.meaningToWord.priority3Required.length
}, null, 2));

if (report.partOfSpeechMismatches.length > 0) {
  console.warn(JSON.stringify({
    warning: "partOfSpeech heuristic review candidates (advisory only)",
    candidates: report.partOfSpeechMismatches.slice(0, 20)
  }, null, 2));
}

const failures = hardFailureCount(report);
if (failures > 0) {
  const details = {
    invalidRows: report.invalidRows.slice(0, 20),
    invalidPartsOfSpeech: report.invalidPartsOfSpeech.slice(0, 20),
    invalidVolumes: report.invalidVolumes.slice(0, 20),
    wordToMeaningInsufficient: report.directions.wordToMeaning.insufficient.slice(0, 20),
    meaningToWordInsufficient: report.directions.meaningToWord.insufficient.slice(0, 20),
    wordToMeaningPriority3Required: report.directions.wordToMeaning.priority3Required.slice(0, 20),
    meaningToWordPriority3Required: report.directions.meaningToWord.priority3Required.slice(0, 20)
  };
  console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

console.log("Vocabulary dataset hard-invariant audit passed.");
