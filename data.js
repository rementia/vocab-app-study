import { volOrder } from "./state.js";
import { normalizeWordKey } from "./wordIdentity.js";

export const availableVolumes = Object.fromEntries(volOrder.map((vol) => [vol, true]));
const ID_COLUMN_NAMES = ["id", "wordid", "word_id", "word id", "単語id"];
const WORD_COLUMN_NAMES = ["word", "単語"];
const MEANING_COLUMN_NAMES = ["meaning", "意味"];
const SYNC_TIME_FIELD_NAMES = ["syncedAt", "updatedAt", "lastSyncedAt"];

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
    headers.some((value) => ID_COLUMN_NAMES.includes(value)) ||
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
  const idIndex = hasHeader ? getHeaderIndex(headerRow, ID_COLUMN_NAMES) : -1;
  const wordIndex = hasHeader ? getHeaderIndex(headerRow, WORD_COLUMN_NAMES) : 0;
  const meaningIndex = hasHeader ? getHeaderIndex(headerRow, MEANING_COLUMN_NAMES) : 1;

  return {
    startIndex: hasHeader ? 1 : 0,
    readId: (cols) => (idIndex >= 0 ? cols[idIndex] || "" : ""),
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
  const stableId = columnReader.readId(cols);
  const word = columnReader.readWord(cols);
  const meaning = columnReader.readMeaning(cols);
  return {
    id: normalizeWordKey(stableId || word),
    word,
    meaning,
    legacyWordKey: normalizeWordKey(word),
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

export function formatFirestoreSyncValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;

  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value.toDate === "function") {
    date = value.toDate();
  } else if (typeof value.seconds === "number") {
    date = new Date((value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000));
  }

  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
}

export function getWordDocSyncLabel(data) {
  if (!data || typeof data !== "object") return "";

  for (const fieldName of SYNC_TIME_FIELD_NAMES) {
    const label = formatFirestoreSyncValue(data[fieldName]);
    if (label) return label;
  }

  return "";
}

export async function fetchWordsForVolWithMeta(volName) {
  const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js");
  const { auth, db } = await import("./firebaseClient.js");
  const user = auth.currentUser;

  if (!user || !availableVolumes[volName]) {
    return {
      words: [],
      meta: {
        volName,
        syncLabel: ""
      }
    };
  }

  const ref = doc(db, "privateWords", volName);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return {
      words: [],
      meta: {
        volName,
        syncLabel: ""
      }
    };
  }

  const data = snap.data();
  const csv = typeof data.csv === "string" ? data.csv : "";
  const words = parseCsvToWords(csv, volName);

  return {
    words,
    meta: {
      volName,
      syncLabel: getWordDocSyncLabel(data)
    }
  };
}

export async function fetchWordsForVol(volName) {
  const { words } = await fetchWordsForVolWithMeta(volName);
  return words;
}
