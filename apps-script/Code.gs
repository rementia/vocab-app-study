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
  // Preferred source sheet. If this sheet has no usable classification data,
  // the script automatically searches other sheets for the required columns.
  sourceSheetName: "シート1",
  levelColumnName: "level",
  requireClassificationData: true,

  volumes: [
    { level: "1", docId: "vol1" },
    { level: "2", docId: "vol2" },
    { level: "3", docId: "vol3" },
    { level: "4", docId: "vol4" }
  ]
};

const ID_COLUMN_NAMES = ["id", "wordid", "word_id", "word id", "単語id"];
const OPTIONAL_WORD_COLUMN_NAMES = [
  "morpheme",
  "morphemeMeaning",
  "semanticDevelopment",
  "partOfSpeech",
  "semanticCategory",
  "phonetic",
  "pronunciationAudioUrl",
  "pronunciationSource",
  "pronunciationStatus"
];
const CLASSIFICATION_COLUMN_NAMES = ["partOfSpeech", "semanticCategory"];
const GENERATED_ID_PREFIX = "w_";
const GENERATED_ID_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const GENERATED_ID_LENGTH = 12;
function diagnoseClassificationSource() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const diagnostics = spreadsheet.getSheets().map(inspectSheetForSync);

  diagnostics.forEach((item) => {
    Logger.log(
      `${item.sheetName}: base=${item.hasBaseColumns}, classificationColumns=${item.hasClassificationColumns}, ` +
      `classifiedRows=${item.classifiedRows}, dataRows=${item.dataRows}`
    );
  });

  const selected = getSourceSheet();
  Logger.log(`選択される同期元: ${selected.getName()}`);
}

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
    Logger.log("doPost開始");

    validateSyncToken(e);
    Logger.log("トークン検証成功");

    const result = syncAllVolumesToFirestore();

    Logger.log(
      `doPost成功: syncedAt=${result.syncedAt}, volumes=${JSON.stringify(result.volumes)}`
    );

    return createJsonResponse({
      ok: true,
      syncedAt: result.syncedAt,
      volumes: result.volumes
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);

    Logger.log(`doPost失敗: ${message}`);
    Logger.log(error && error.stack ? error.stack : "");

    return createJsonResponse({
      ok: false,
      error: message
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
  validateClassificationRows(groupedRows);
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
  const optionalColumnIndexes = OPTIONAL_WORD_COLUMN_NAMES.map((columnName) => ({
    columnName,
    index: getColumnIndexByNames(headers, [normalizeHeader(columnName)])
  }));

  const groupedRows = {};

  CONFIG.volumes.forEach(({ docId }) => {
    groupedRows[docId] = [["id", "word", "meaning", ...OPTIONAL_WORD_COLUMN_NAMES]];
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

    const optionalValues = optionalColumnIndexes.map(({ index }) => (
      index >= 0 ? String(row[index] ?? "").trim() : ""
    ));

    groupedRows[volume.docId].push([stableId, word, meaning, ...optionalValues]);
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
  const wordIndex = getRequiredColumnIndex(headers, "word");

  if (idIndex === -1) {
    idIndex = values[0].length;
    sheet.getRange(1, idIndex + 1).setValue("id");
  }

  const usedIds = new Set();
  const idRows = {};

  values.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const word = String(row[wordIndex] ?? "").trim();
    if (!word) return;

    const currentId = String(row[idIndex] ?? "").trim();
    if (currentId) {
      if (usedIds.has(currentId)) {
        throw new Error(`重複idがあります: ${currentId} (row ${idRows[currentId]} と row ${rowNumber})`);
      }
      usedIds.add(currentId);
      idRows[currentId] = rowNumber;
      return;
    }

    const newId = generateStableWordId(usedIds);
    sheet.getRange(rowNumber, idIndex + 1).setValue(newId);
    usedIds.add(newId);
    idRows[newId] = rowNumber;
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
  const sheets = spreadsheet.getSheets();

  if (!sheets.length) {
    throw new Error("スプレッドシートにシートがありません。");
  }

  const preferredSheet = CONFIG.sourceSheetName
    ? spreadsheet.getSheetByName(CONFIG.sourceSheetName)
    : null;

  const orderedSheets = preferredSheet
    ? [preferredSheet, ...sheets.filter((sheet) => sheet.getSheetId() !== preferredSheet.getSheetId())]
    : sheets;

  const diagnostics = orderedSheets.map(inspectSheetForSync);
  const usable = diagnostics.filter((item) => item.hasBaseColumns && item.hasClassificationColumns);

  if (!usable.length) {
    const summary = diagnostics
      .map((item) => `${item.sheetName}: base=${item.hasBaseColumns}, classificationColumns=${item.hasClassificationColumns}, classifiedRows=${item.classifiedRows}`)
      .join(" / ");
    throw new Error(
      "word / meaning / level / partOfSpeech / semanticCategory を備えた同期元シートが見つかりません。" +
      (summary ? ` 候補: ${summary}` : "")
    );
  }

  const withData = usable.filter((item) => item.classifiedRows > 0);
  const selected = (withData.length ? withData : usable)[0];

  if (CONFIG.requireClassificationData && selected.classifiedRows === 0) {
    throw new Error(
      `分類データが空のため同期を中止しました: ${selected.sheetName} ` +
      "(partOfSpeech / semanticCategory に値がありません)"
    );
  }

  Logger.log(
    `同期元シート: ${selected.sheetName} / 分類済み行: ${selected.classifiedRows} / データ行: ${selected.dataRows}`
  );
  return selected.sheet;
}

function inspectSheetForSync(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    return {
      sheet,
      sheetName: sheet.getName(),
      hasBaseColumns: false,
      hasClassificationColumns: false,
      classifiedRows: 0,
      dataRows: 0
    };
  }

  const headers = values[0].map(normalizeHeader);
  const wordIndex = getColumnIndexByNames(headers, [normalizeHeader("word")]);
  const meaningIndex = getColumnIndexByNames(headers, [normalizeHeader("meaning")]);
  const levelIndex = getColumnIndexByNames(headers, [normalizeHeader(CONFIG.levelColumnName)]);
  const partOfSpeechIndex = getColumnIndexByNames(headers, [normalizeHeader("partOfSpeech")]);
  const semanticCategoryIndex = getColumnIndexByNames(headers, [normalizeHeader("semanticCategory")]);

  const hasBaseColumns = wordIndex >= 0 && meaningIndex >= 0 && levelIndex >= 0;
  const hasClassificationColumns = partOfSpeechIndex >= 0 && semanticCategoryIndex >= 0;

  let dataRows = 0;
  let classifiedRows = 0;

  if (hasBaseColumns) {
    values.slice(1).forEach((row) => {
      const word = String(row[wordIndex] ?? "").trim();
      if (!word) return;
      dataRows += 1;

      if (hasClassificationColumns) {
        const partOfSpeech = String(row[partOfSpeechIndex] ?? "").trim();
        const semanticCategory = String(row[semanticCategoryIndex] ?? "").trim();
        if (partOfSpeech || semanticCategory) classifiedRows += 1;
      }
    });
  }

  return {
    sheet,
    sheetName: sheet.getName(),
    hasBaseColumns,
    hasClassificationColumns,
    classifiedRows,
    dataRows
  };
}

function validateClassificationRows(groupedRows) {
  if (!CONFIG.requireClassificationData) return;

  CONFIG.volumes.forEach(({ docId }) => {
    const rows = groupedRows[docId] || [];
    if (rows.length < 2) return;

    const headers = rows[0].map(normalizeHeader);
    const partOfSpeechIndex = getColumnIndexByNames(headers, [normalizeHeader("partOfSpeech")]);
    const semanticCategoryIndex = getColumnIndexByNames(headers, [normalizeHeader("semanticCategory")]);

    if (partOfSpeechIndex < 0 || semanticCategoryIndex < 0) {
      throw new Error(`${docId}: 分類列がCSVヘッダーにありません。`);
    }

    const classifiedRows = rows.slice(1).filter((row) => {
      const partOfSpeech = String(row[partOfSpeechIndex] ?? "").trim();
      const semanticCategory = String(row[semanticCategoryIndex] ?? "").trim();
      return partOfSpeech || semanticCategory;
    }).length;

    if (classifiedRows === 0) {
      throw new Error(
        `${docId}: partOfSpeech / semanticCategory が全件空のため、Firestore上書きを中止しました。`
      );
    }

    Logger.log(`${docId}: 分類情報あり ${classifiedRows}/${rows.length - 1}語`);
  });
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
      grant_type: "urn:ietf:params:oauth-grant-type:jwt-bearer",
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
