import { volOrder } from "./state.js";
import { normalizeWordKey } from "./wordIdentity.js";

export const availableVolumes = Object.fromEntries(volOrder.map((vol) => [vol, true]));
const WORD_COLUMN_NAMES = ["word", "単語"];
const MEANING_COLUMN_NAMES = ["meaning", "意味"];

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function normalizeLineEndings(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function parseCsv(text) {
  if (typeof text !== "string") return [];

  const normalizedText = normalizeLineEndings(stripBom(text));
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < normalizedText.length; i += 1) {
    const char = normalizedText[i];
    const nextChar = normalizedText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function hasHeaderRow(row) {
  const headers = row.map((cell) => String(cell ?? "").toLowerCase().trim());
  return (
    headers.some((value) => WORD_COLUMN_NAMES.includes(value)) ||
    headers.some((value) => MEANING_COLUMN_NAMES.includes(value))
  );
}

function getHeaderIndex(row, names) {
  return row.findIndex((cell) => names.includes(String(cell ?? "").toLowerCase().trim()));
}

function createColumnReader(rows) {
  const hasHeader = rows.length > 0 && hasHeaderRow(rows[0]);
  const headerRow = hasHeader ? rows[0] : [];
  const wordIndex = hasHeader ? getHeaderIndex(headerRow, WORD_COLUMN_NAMES) : 0;
  const meaningIndex = hasHeader ? getHeaderIndex(headerRow, MEANING_COLUMN_NAMES) : 1;

  return {
    startIndex: hasHeader ? 1 : 0,
    readWord: (cols) => cols[wordIndex >= 0 ? wordIndex : 0] || "",
    readMeaning: (cols) => {
      if (meaningIndex >= 0) return cols[meaningIndex] || "";
      return cols.slice(1).filter(Boolean).join(", ").trim();
    }
  };
}

function normalizeCsvRows(text) {
  return parseCsv(text)
    .map((cols) => cols.map((col) => String(col ?? "").trim()))
    .filter((cols) => cols.some((col) => col !== ""));
}

function createWordItem(cols, columnReader, volName) {
  const word = columnReader.readWord(cols);
  const meaning = columnReader.readMeaning(cols);
  return {
    id: normalizeWordKey(word),
    word,
    meaning,
    sourceVol: volName
  };
}

export function parseCsvToWords(text, volName) {
  const rows = normalizeCsvRows(text);
  const columnReader = createColumnReader(rows);

  return rows.slice(columnReader.startIndex)
    .map((cols) => createWordItem(cols, columnReader, volName))
    .filter((item) => item.word);
}

export async function fetchWordsForVol(volName) {
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js");
  const { auth, db } = await import("./firebaseClient.js");
  const user = auth.currentUser;

  if (!user || !availableVolumes[volName]) {
    return [];
  }

  const ref = doc(db, "privateWords", volName);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return [];
  }

  const data = snap.data();
  const csv = typeof data.csv === "string" ? data.csv : "";
  return parseCsvToWords(csv, volName);
}
