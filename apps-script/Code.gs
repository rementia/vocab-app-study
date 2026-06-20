/**
 * Google Sheets -> Firestore privateWords/{vol}.csv sync sample.
 *
 * This script is intentionally a sample for the study version. It writes CSV
 * strings to Firestore and does not change the web app data loading flow.
 *
 * Before running:
 * - Replace YOUR_FIREBASE_PROJECT_ID or set Script Property FIREBASE_PROJECT_ID.
 * - Confirm the Apps Script Google Cloud project can access Firestore.
 * - Do not paste service account private keys or other secrets into this file.
 */
const CONFIG = {
  firebaseProjectId: "YOUR_FIREBASE_PROJECT_ID",
  firebaseProjectIdPropertyName: "FIREBASE_PROJECT_ID",
  firestoreDatabaseId: "(default)",
  collectionName: "privateWords",

  // "sheetsByVolume" or "singleSheetWithLevel"
  mode: "sheetsByVolume",
  volumeSheetNames: ["vol1", "vol2", "vol3", "vol4"],
  singleSheetName: "words",
  levelColumnName: "level"
};

function syncVocabularyToFirestore() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const csvByVolume = CONFIG.mode === "singleSheetWithLevel"
    ? buildCsvByVolumeFromSingleSheet(spreadsheet)
    : buildCsvByVolumeFromVolumeSheets(spreadsheet);

  const syncedAt = new Date().toISOString();

  CONFIG.volumeSheetNames.forEach((volName) => {
    const csv = csvByVolume[volName] || "";
    writePrivateWordsDocument(volName, csv, syncedAt);
  });
}

function buildCsvByVolumeFromVolumeSheets(spreadsheet) {
  return Object.fromEntries(CONFIG.volumeSheetNames.map((volName) => {
    const sheet = spreadsheet.getSheetByName(volName);
    if (!sheet) {
      throw new Error(`Sheet not found: ${volName}`);
    }

    return [volName, rowsToCsv(readSheetRows(sheet))];
  }));
}

function buildCsvByVolumeFromSingleSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(CONFIG.singleSheetName);
  if (!sheet) {
    throw new Error(`Sheet not found: ${CONFIG.singleSheetName}`);
  }

  const rows = readSheetRows(sheet);
  if (!rows.length) {
    return Object.fromEntries(CONFIG.volumeSheetNames.map((volName) => [volName, ""]));
  }

  const header = rows[0];
  const levelIndex = findColumnIndex(header, CONFIG.levelColumnName);
  if (levelIndex < 0) {
    throw new Error(`Column not found: ${CONFIG.levelColumnName}`);
  }

  const groupedRows = Object.fromEntries(CONFIG.volumeSheetNames.map((volName) => [volName, [header]]));

  rows.slice(1).forEach((row) => {
    const volName = normalizeVolumeName(row[levelIndex]);
    if (!groupedRows[volName]) return;
    groupedRows[volName].push(row);
  });

  return Object.fromEntries(CONFIG.volumeSheetNames.map((volName) => [
    volName,
    rowsToCsv(groupedRows[volName])
  ]));
}

function readSheetRows(sheet) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();
  return values.filter((row) => row.some((cell) => String(cell).trim() !== ""));
}

function findColumnIndex(header, columnName) {
  const targetName = String(columnName).toLowerCase().trim();
  return header.findIndex((cell) => String(cell).toLowerCase().trim() === targetName);
}

function normalizeVolumeName(value) {
  const normalized = String(value).toLowerCase().trim();
  if (/^vol[1-4]$/.test(normalized)) return normalized;
  if (/^[1-4]$/.test(normalized)) return `vol${normalized}`;
  return normalized;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writePrivateWordsDocument(volName, csv, syncedAt) {
  const projectId = getFirebaseProjectId();
  const databaseId = encodeURIComponent(CONFIG.firestoreDatabaseId);
  const documentPath = `${CONFIG.collectionName}/${volName}`;
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${documentPath}`
    + "?updateMask.fieldPaths=csv&updateMask.fieldPaths=syncedAt";

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
    },
    payload: JSON.stringify({
      fields: {
        csv: { stringValue: csv },
        syncedAt: { timestampValue: syncedAt }
      }
    }),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`Firestore write failed for ${volName}: ${status} ${response.getContentText()}`);
  }
}

function getFirebaseProjectId() {
  const propertyValue = PropertiesService.getScriptProperties()
    .getProperty(CONFIG.firebaseProjectIdPropertyName);
  const projectId = propertyValue || CONFIG.firebaseProjectId;

  if (!projectId || projectId === "YOUR_FIREBASE_PROJECT_ID") {
    throw new Error("Set Firebase Project ID in CONFIG or Script Properties.");
  }

  return projectId;
}
