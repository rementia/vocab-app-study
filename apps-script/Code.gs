/**
 * Google Sheets -> Firestore privateWords/{vol}.csv sync sample.
 *
 * This script writes CSV strings to Firestore for the study version:
 *
 * privateWords/{vol}
 *   csv: "word,meaning,..."
 *   syncedAt: "2026-06-20T12:34:56.000Z"
 *
 * Do not paste service account private keys directly into this file.
 * Store CLIENT_EMAIL, PRIVATE_KEY, and SYNC_TOKEN in Apps Script Properties.
 */
const CONFIG = {
  firebaseProjectId: "svl-app-65204",
  collectionName: "privateWords",

  // "sheetsByVolume" or "singleSheetWithLevel"
  mode: "singleSheetWithLevel",

  // sheetsByVolume mode uses one sheet per docId.
  volumeSheetNames: ["vol1", "vol2", "vol3", "vol4"],

  // singleSheetWithLevel mode reads one sheet and splits rows by level.
  sourceSheetName: "シート1",
  levelColumnName: "level",

  volumes: [
    { level: "1", docId: "vol1" },
    { level: "2", docId: "vol2" },
    { level: "3", docId: "vol3" },
    { level: "4", docId: "vol4" }
  ]
};

const ID_COLUMN_NAMES = ["id", "wordid", "word_id", "word id", "単語id"];
const GENERATED_ID_PREFIX = "w_";
const GENERATED_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const GENERATED_ID_LENGTH = 12;
function dryRun() {
  const groupedRows = buildGroupedRows();

  CONFIG.volumes.forEach(({ docId }) => {
    const wordCount = Math.max((groupedRows[docId] || []).length - 1, 0);
    Logger.log(`${docId}: ${wordCount} words`);
  });

  Logger.log("dryRun完了: Firestoreには保存していません。");
}

function doPost(e) {
  try {
    validateSyncToken(e);
    const result = syncAllVolumesToFirestore();
    return createJsonResponse({
      ok: true,
      syncedAt: result.syncedAt,
      volumes: result.volumes
    });
  } catch (error) {
    return createJsonResponse({
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function syncAllVolumesToFirestore() {
  const groupedRows = buildGroupedRows();
  const syncedAt = new Date().toISOString();
  const volumes = [];

  CONFIG.volumes.forEach(({ docId }) => {
    const rows = groupedRows[docId] || [];
    uploadCsvToFirestore(docId, rowsToCsv(rows), syncedAt, rows);
    volumes.push({
      docId,
      rowCount: getWordCount(rows)
    });
  });

  Logger.log("全volのFirestore同期が完了しました。");
  return {
    syncedAt,
    volumes
  };
}

function syncVol1() {
  syncOneVolume("vol1");
}

function syncVol2() {
  syncOneVolume("vol2");
}

function syncVol3() {
  syncOneVolume("vol3");
}

function syncVol4() {
  syncOneVolume("vol4");
}

function syncOneVolume(docId) {
  const groupedRows = buildGroupedRows();

  if (!groupedRows[docId]) {
    throw new Error(`未定義のdocIdです: ${docId}`);
  }

  const syncedAt = new Date().toISOString();
  uploadCsvToFirestore(docId, rowsToCsv(groupedRows[docId]), syncedAt, groupedRows[docId]);
  Logger.log(`${docId} の同期が完了しました。`);
  return {
    syncedAt,
    volumes: [{
      docId,
      rowCount: getWordCount(groupedRows[docId])
    }]
  };
}

function buildGroupedRows() {
  let groupedRows = null;

  if (CONFIG.mode === "sheetsByVolume") {
    groupedRows = buildGroupedRowsFromVolumeSheets();
  } else if (CONFIG.mode === "singleSheetWithLevel") {
    groupedRows = buildGroupedRowsFromSingleSheet();
  } else {
    throw new Error(`未対応のmodeです: ${CONFIG.mode}`);
  }

  validateGroupedRowIds(groupedRows);
  return groupedRows;
}

function buildGroupedRowsFromVolumeSheets() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const groupedRows = {};

  CONFIG.volumeSheetNames.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${sheetName}`);
    }

    ensureStableIds(sheet);
    groupedRows[sheetName] = readSheetRows(sheet);
  });

  return groupedRows;
}

function buildGroupedRowsFromSingleSheet() {
  const sheet = getSourceSheet();
  ensureStableIds(sheet);
  const values = readSheetRows(sheet);

  if (values.length < 2) {
    throw new Error("データ行がありません。");
  }

  const headers = values[0].map(normalizeHeader);
  const idIndex = getRequiredColumnIndexByNames(headers, ID_COLUMN_NAMES, "id");
  const wordIndex = getRequiredColumnIndex(headers, "word");
  const meaningIndex = getRequiredColumnIndex(headers, "meaning");
  const levelIndex = getRequiredColumnIndex(headers, CONFIG.levelColumnName);

  const groupedRows = {};

  CONFIG.volumes.forEach(({ docId }) => {
    groupedRows[docId] = [["id", "word", "meaning"]];
  });

  values.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const stableId = String(row[idIndex] ?? "").trim();
    const word = String(row[wordIndex] ?? "").trim();
    const meaning = String(row[meaningIndex] ?? "").trim();
    const level = normalizeLevel(row[levelIndex]);

    if (!word) {
      return;
    }

    const volume = CONFIG.volumes.find((item) => item.level === level || item.docId === level);

    if (!volume) {
      Logger.log(`未対応のlevelをスキップしました: row ${rowNumber}, level=${level}`);
      return;
    }

    groupedRows[volume.docId].push([stableId, word, meaning]);
  });

  return groupedRows;
}


function getColumnIndexByNames(headers, names) {
  return headers.findIndex((header) => names.includes(header));
}

function getRequiredColumnIndexByNames(headers, names, label) {
  const index = getColumnIndexByNames(headers, names);

  if (index === -1) {
    throw new Error(`必須列が見つかりません: ${label}`);
  }

  return index;
}

function ensureStableIds(sheet) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();

  if (!values.length) return;

  const headers = values[0].map(normalizeHeader);
  let idIndex = getColumnIndexByNames(headers, ID_COLUMN_NAMES);

  if (idIndex === -1) {
    idIndex = values[0].length;
    sheet.getRange(1, idIndex + 1).setValue("id");
  }

  const usedIds = new Set();

  values.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const hasData = row.some((cell) => String(cell ?? "").trim() !== "");
    if (!hasData) return;

    const currentId = String(row[idIndex] ?? "").trim();
    if (currentId) {
      if (usedIds.has(currentId)) {
        throw new Error(`重複idがあります: ${currentId} (row ${rowNumber})`);
      }
      usedIds.add(currentId);
      return;
    }

    const newId = generateStableWordId(usedIds);
    sheet.getRange(rowNumber, idIndex + 1).setValue(newId);
    usedIds.add(newId);
  });
}

function generateStableWordId(usedIds) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    let body = "";
    for (let i = 0; i < GENERATED_ID_LENGTH; i += 1) {
      body += GENERATED_ID_CHARS.charAt(Math.floor(Math.random() * GENERATED_ID_CHARS.length));
    }

    const id = `${GENERATED_ID_PREFIX}${body}`;
    if (!usedIds.has(id)) return id;
  }

  throw new Error("新しいidを生成できませんでした。");
}

function validateGroupedRowIds(groupedRows) {
  const usedIds = new Set();

  Object.entries(groupedRows).forEach(([docId, rows]) => {
    if (!rows || rows.length < 2) return;

    const headers = rows[0].map(normalizeHeader);
    const idIndex = getColumnIndexByNames(headers, ID_COLUMN_NAMES);
    if (idIndex === -1) return;

    rows.slice(1).forEach((row, index) => {
      const id = String(row[idIndex] ?? "").trim();
      if (!id) return;

      if (usedIds.has(id)) {
        throw new Error(`重複idがあります: ${id} (${docId} row ${index + 2})`);
      }

      usedIds.add(id);
    });
  });
}

function getSourceSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  if (CONFIG.sourceSheetName) {
    const sheet = spreadsheet.getSheetByName(CONFIG.sourceSheetName);

    if (!sheet) {
      throw new Error(`シートが見つかりません: ${CONFIG.sourceSheetName}`);
    }

    return sheet;
  }

  const sheet = spreadsheet.getSheets()[0];

  if (!sheet) {
    throw new Error("スプレッドシートにシートがありません。");
  }

  return sheet;
}

function readSheetRows(sheet) {
  return sheet.getDataRange()
    .getDisplayValues()
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));
}

function getWordCount(rows) {
  return Math.max((rows || []).length - 1, 0);
}

function getRequiredColumnIndex(headers, columnName) {
  const index = headers.indexOf(normalizeHeader(columnName));

  if (index === -1) {
    throw new Error(`必須列が見つかりません: ${columnName}`);
  }

  return index;
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeLevel(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^vol\.?\s*/i, "")
    .replace(/^level\s*/i, "");
}

function rowsToCsv(rows) {
  return rows
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function uploadCsvToFirestore(docId, csv, syncedAt, rows) {
  const accessToken = getAccessToken();

  const documentPath =
    `projects/${CONFIG.firebaseProjectId}` +
    `/databases/(default)/documents/${CONFIG.collectionName}/${docId}`;

  const url =
    `https://firestore.googleapis.com/v1/${documentPath}` +
    "?updateMask.fieldPaths=csv&updateMask.fieldPaths=syncedAt";

  const payload = {
    fields: {
      csv: {
        stringValue: csv
      },
      syncedAt: {
        timestampValue: syncedAt
      }
    }
  };

  const csvRowCount = Math.max((rows || []).length - 1, 0);
  Logger.log(`同期開始: ${docId}`);
  Logger.log(`CSV行数: ${csvRowCount}`);
  Logger.log(`Firestore保存先: ${CONFIG.collectionName}/${docId}.csv`);
  Logger.log(`syncedAt: ${syncedAt}`);

  const response = UrlFetchApp.fetch(url, {
    method: "patch",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${accessToken}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    Logger.log(`Firestore保存失敗: ${docId}, status=${status}`);
    throw new Error(
      `Firestore保存失敗: ${docId}\n` +
      `status: ${status}\n` +
      response.getContentText()
    );
  }

  Logger.log(`Firestore保存成功: ${CONFIG.collectionName}/${docId}`);
}

function getAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty("CLIENT_EMAIL");
  const privateKey = props.getProperty("PRIVATE_KEY");

  if (!clientEmail || !privateKey) {
    throw new Error("CLIENT_EMAIL または PRIVATE_KEY が設定されていません。");
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);

  const claimSet = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

  const signatureBytes = Utilities.computeRsaSha256Signature(
    signatureInput,
    formattedPrivateKey
  );

  const jwt = `${signatureInput}.${base64UrlEncode(signatureBytes)}`;

  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post",
    payload: {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    },
    muteHttpExceptions: true
  });

  const data = JSON.parse(response.getContentText());

  if (!data.access_token) {
    throw new Error("アクセストークン取得失敗:\n" + response.getContentText());
  }

  return data.access_token;
}

function base64UrlEncode(value) {
  const bytes =
    typeof value === "string"
      ? Utilities.newBlob(value).getBytes()
      : value;

  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
}

function validateSyncToken(e) {
  const expectedToken = PropertiesService
    .getScriptProperties()
    .getProperty("SYNC_TOKEN");

  if (!expectedToken) {
    throw new Error("SYNC_TOKEN が設定されていません。");
  }

  const requestData = parseRequestData(e);

  if (requestData.token !== expectedToken) {
    throw new Error("Invalid token");
  }
}

function parseRequestData(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw new Error("Invalid JSON request body");
  }
}

function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
