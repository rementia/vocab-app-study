import { volOrder } from "./state.js";

export const availableVolumes = Object.fromEntries(volOrder.map((vol) => [vol, true]));

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

export function normalizeWord(word) {
  return String(word).toLowerCase().trim();
}

function hasHeaderRow(row) {
  const headers = row.map((cell) => String(cell ?? "").toLowerCase().trim());
  return (
    headers.some((value) => value === "word" || value === "単語") ||
    headers.some((value) => value === "meaning" || value === "意味")
  );
}

export function parseCsvToWords(text, volName) {
  const rows = parseCsv(text)
    .map((cols) => cols.map((col) => String(col ?? "").trim()))
    .filter((cols) => cols.some((col) => col !== ""));

  const startIndex = rows.length > 0 && hasHeaderRow(rows[0]) ? 1 : 0;

  return rows.slice(startIndex)
    .map((cols, rowIndex) => {
      const word = cols[0] || "";
      const meaning = cols.slice(1).filter(Boolean).join(", ").trim();
      const id = `${volName}-${rowIndex + startIndex + 1}-${normalizeWord(word)}`;
      return {
        id,
        word,
        meaning,
        sourceVol: volName
      };
    })
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
