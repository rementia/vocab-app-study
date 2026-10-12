/**
 * Google Sheets -> Firestore privateWords/{vol}.csv sync sample.
 *
 * This script writes CSV strings to Firestore for the study version:
 *
 * privateWords/{vol}
 *   csv: "word,meaning,..."
 *   syncedAt: "2026-06-20T12:34:56.000Z"
 *
 * Oversized CSV payloads are stored as gzip+base64 in csvGzipBase64 so each
 * volume still uses a single Firestore document/read without exceeding the
 * Firestore string/document size limit.
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
  // Explicit source sheet. If it is missing or invalid, fail closed.
  // Never silently fall back to a different sheet.
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
const FIRESTORE_SAFE_STRING_BYTES = 900000;

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
  const groupedRows = buildGroupedRows({ preview: true });

  CONFIG.volumes.forEach(({ docId }) => {
    const wordCount = Math.max((groupedRows[docId] || []).length - 1, 0);
    const csv = rowsToCsv(groupedRows[docId] || []);
    const rawBytes = getUtf8ByteLength(csv);
    const storageMode = rawBytes <= FIRESTORE_SAFE_STRING_BYTES ? "plain" : "gzip-base64";
    Logger.log(`${docId}: ${wordCount} words / ${rawBytes} bytes / ${storageMode}`);
  });

  Logger.log("dryRun完了: Google Sheets / Firestore ともに変更していません。");
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
  return withSyncLock(() => {
    const groupedRows = buildGroupedRows({
      nonEmptyDocIds: CONFIG.volumes.map(({ docId }) => docId)
    });
    const syncedAt = new Date().toISOString();

    // Prepare and size-check EVERY document before making any Firestore request.
    // Commit applies all four writes atomically; a failed commit changes none.
    const prepared = CONFIG.volumes.map(({ docId }) => {
      const rows = groupedRows[docId] || [];
      return prepareFirestoreWrite(docId, rowsToCsv(rows), syncedAt, rows);
    });

    commitFirestoreWrites(prepared);
    Logger.log("全volのFirestore一括同期が完了しました。");
    return {
      syncedAt,
      volumes: prepared.map(({ docId, rowCount, storageMode, storedBytes }) => ({
        docId, rowCount, storageMode, storedBytes
      }))
    };
  });
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
  return withSyncLock(() => {
    const groupedRows = buildGroupedRows({ nonEmptyDocIds: [docId] });

    if (!groupedRows[docId]) {
      throw new Error(`未定義のdocIdです: ${docId}`);
    }

    const syncedAt = new Date().toISOString();
    const prepared = prepareFirestoreWrite(
      docId,
      rowsToCsv(groupedRows[docId]),
      syncedAt,
      groupedRows[docId]
    );
    commitFirestoreWrites([prepared]);
    Logger.log(`${docId} の同期が完了しました。`);
    return {
      syncedAt,
      volumes: [{
        docId,
        rowCount: prepared.rowCount,
        storageMode: prepared.storageMode,
        storedBytes: prepared.storedBytes
      }]
    };
  });
}

function withSyncLock(run) {
  // Serialize executions belonging to this Apps Script project, including
  // manual runs and legacy doPost calls. Never release a lock we did not get.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("別の語彙同期処理が実行中です。完了後に再実行してください。");
  }
  try {
    return run();
  } finally {
    lock.releaseLock();
  }
}

function buildGroupedRows({ preview = false, nonEmptyDocIds = [] } = {}) {
  // First prepare every generated ID in memory. Never mutate Sheets until
  // the entire dataset passes validation, including cross-volume checks.
  const pendingIdWrites = [];
  let groupedRows = null;

  if (CONFIG.mode === "sheetsByVolume") {
    groupedRows = buildGroupedRowsFromVolumeSheets({ pendingIdWrites });
  } else if (CONFIG.mode === "singleSheetWithLevel") {
    groupedRows = buildGroupedRowsFromSingleSheet({ pendingIdWrites });
  } else {
    throw new Error(`未対応のmodeです: ${CONFIG.mode}`);
  }

  validateGroupedRowIds(groupedRows);
  validateClassificationRows(groupedRows);
  validateNonEmptyVolumes(groupedRows, nonEmptyDocIds);

  if (!preview) {
    persistGeneratedIds(pendingIdWrites);
  }

  return groupedRows;
}

// Google Sheets writes are not transactional with Firestore. Pre-check all
// target cells, and verify persisted values before starting Firestore writes.
// If a write fails partway, the partial IDs remain in Sheets but the next sync
// can safely reuse them; Firestore is NOT updated by this attempt.
function persistGeneratedIds(pendingIdWrites) {
  const targets = pendingIdWrites.map(({ sheet, row, column, value }) => {
    const range = sheet.getRange(row, column);
    const current = String(range.getDisplayValue() ?? "").trim();
    if (current !== "") {
      throw new Error(
        `ID書込先が既に変更されています: ${sheet.getName()} 行${row} 列${column}。Firestore同期を中止しました。`
      );
    }
    return { range, sheetName: sheet.getName(), row, column, value };
  });

  for (const target of targets) {
    const position = `${target.sheetName} 行${target.row} 列${target.column}`;
    try {
      target.range.setValue(target.value);
      SpreadsheetApp.flush();
      const persisted = String(target.range.getDisplayValue() ?? "").trim();
      if (persisted !== target.value) {
        throw new Error("書込後のIDが一致しません。");
      }
    } catch (error) {
      throw new Error(
        `ID保存検証失敗: ${position}。Firestoreには未同期です。` +
        "一部のIDだけGoogle Sheetsに保存されている可能性があります。" +
        `原因: ${error && error.message ? error.message : String(error)}`
      );
    }
  }
}

function buildGroupedRowsFromVolumeSheets({ pendingIdWrites }) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const groupedRows = {};

  CONFIG.volumeSheetNames.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error(`シートが見つかりません: ${sheetName}`);
    }

    groupedRows[sheetName] = ensureStableIds(sheet, { pendingIdWrites });
  });

  return groupedRows;
}

function buildGroupedRowsFromSingleSheet({ pendingIdWrites }) {
  const sheet = getSourceSheet();
  const values = ensureStableIds(sheet, { pendingIdWrites });

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
      throw new Error(`未対応のlevelです: row ${rowNumber}, level=${level}。単語欠落を防ぐため同期を中止しました。`);
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

function ensureStableIds(sheet, { pendingIdWrites }) {
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();

  if (!values.length) return [];

  const headers = values[0].map(normalizeHeader);
  let idIndex = getColumnIndexByNames(headers, ID_COLUMN_NAMES);
  const wordIndex = getRequiredColumnIndex(headers, "word");

  if (idIndex === -1) {
    idIndex = values[0].length;
    pendingIdWrites.push({ sheet, row: 1, column: idIndex + 1, value: "id" });
    values[0][idIndex] = "id";
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
    pendingIdWrites.push({ sheet, row: rowNumber, column: idIndex + 1, value: newId });
    row[idIndex] = newId;
    usedIds.add(newId);
    idRows[newId] = rowNumber;
  });

  return values.filter((row) => row.some((cell) => String(cell).trim() !== ""));
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

  const preferredName = String(CONFIG.sourceSheetName || "").trim();
  if (preferredName) {
    const sheet = spreadsheet.getSheetByName(preferredName);
    if (!sheet) {
      throw new Error(
        `指定された同期元シートが存在しません: ${preferredName}。別シートへの自動切替は行いません。`
      );
    }
    const inspected = inspectSheetForSync(sheet);
    if (!inspected.hasBaseColumns || !inspected.hasClassificationColumns) {
      throw new Error(
        `指定された同期元シートの必須列が不足しています: ${preferredName}。別シートへの自動切替は行いません。`
      );
    }
    if (CONFIG.requireClassificationData && inspected.classifiedRows === 0) {
      throw new Error(
        `指定された同期元シートの分類データが空です: ${preferredName}。別シートへの自動切替は行いません。`
      );
    }
    Logger.log(`同期元シート: ${inspected.sheetName} / 分類済み行: ${inspected.classifiedRows} / データ行: ${inspected.dataRows}`);
    return sheet;
  }

  const inspected = sheets.map(inspectSheetForSync);
  const usable = inspected.filter((item) => (
    item.hasBaseColumns &&
    item.hasClassificationColumns &&
    (!CONFIG.requireClassificationData || item.classifiedRows > 0)
  ));
  if (!usable.length) {
    throw new Error("必要な列と分類情報を備えた同期元シートがありません。");
  }
  if (usable.length !== 1) {
    throw new Error(
      `同期元シートが複数見つかりました: ${usable.map((item) => item.sheetName).join(", ")}。CONFIG.sourceSheetName を指定してください。`
    );
  }
  const selected = usable[0];
  Logger.log(`同期元シート: ${selected.sheetName} / 分類済み行: ${selected.classifiedRows} / データ行: ${selected.dataRows}`);
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

function validateNonEmptyVolumes(groupedRows, docIds) {
  docIds.forEach((docId) => {
    if (getWordCount(groupedRows[docId]) === 0) {
      throw new Error(`${docId}: 単語数が0件のため、Firestoreへの上書きを中止しました。`);
    }
  });
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

function getUtf8ByteLength(text) {
  return Utilities.newBlob(String(text ?? ""), "text/plain").getBytes().length;
}

function gzipCsvToBase64(csv) {
  const sourceBlob = Utilities.newBlob(csv, "text/csv", "words.csv");
  const gzipBlob = Utilities.gzip(sourceBlob, "words.csv.gz");
  return Utilities.base64Encode(gzipBlob.getBytes());
}

function prepareFirestoreWrite(docId, csv, syncedAt, rows) {
  const rawBytes = getUtf8ByteLength(csv);
  const useCompression = rawBytes > FIRESTORE_SAFE_STRING_BYTES;
  const compressedBase64 = useCompression ? gzipCsvToBase64(csv) : "";
  const storedBytes = useCompression ? getUtf8ByteLength(compressedBase64) : rawBytes;

  if (storedBytes > FIRESTORE_SAFE_STRING_BYTES) {
    throw new Error(
      `${docId}: 圧縮後のCSVもFirestore安全上限を超えています。` +
      ` raw=${rawBytes} bytes, stored=${storedBytes} bytes`
    );
  }

  const documentPath =
    `projects/${CONFIG.firebaseProjectId}` +
    `/databases/(default)/documents/${CONFIG.collectionName}/${docId}`;
  const updateFields = [
    "csv",
    "csvGzipBase64",
    "csvEncoding",
    "uncompressedBytes",
    "storedBytes",
    "syncedAt"
  ];
  const fields = {
    csvEncoding: {
      stringValue: useCompression ? "gzip-base64" : "plain"
    },
    uncompressedBytes: { integerValue: String(rawBytes) },
    storedBytes: { integerValue: String(storedBytes) },
    syncedAt: { timestampValue: syncedAt }
  };

  if (useCompression) {
    fields.csvGzipBase64 = { stringValue: compressedBase64 };
  } else {
    fields.csv = { stringValue: csv };
  }

  const rowCount = Math.max((rows || []).length - 1, 0);
  Logger.log(`同期準備: ${docId}, ${rowCount}語, ${storedBytes}bytes, ${useCompression ? "gzip-base64" : "plain"}`);
  return {
    docId,
    rowCount,
    storageMode: useCompression ? "gzip-base64" : "plain",
    storedBytes,
    write: {
      update: { name: documentPath, fields },
      // Masked-but-omitted csv/csvGzipBase64 clears a stale encoding field.
      updateMask: { fieldPaths: updateFields }
    }
  };
}

function commitFirestoreWrites(prepared) {
  if (!prepared.length) {
    throw new Error("Firestoreに書き込むデータがありません。");
  }

  const accessToken = getAccessToken();
  const url =
    `https://firestore.googleapis.com/v1/projects/${CONFIG.firebaseProjectId}` +
    "/databases/(default)/documents:commit";
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${accessToken}` },
    payload: JSON.stringify({ writes: prepared.map(({ write }) => write) }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();

  if (status < 200 || status >= 300) {
    Logger.log(`Firestore一括保存失敗: status=${status}`);
    throw new Error(
      `Firestore一括保存失敗: HTTP ${status}。全巻の変更は確定していません。`
    );
  }

  // An HTTP success is not enough to assert that every requested write
  // was acknowledged. Avoid silently reporting success on malformed responses.
  let result;
  try {
    result = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error("Firestore応答の解析に失敗。書込済みの可能性があるため、再実行前に本番データを確認してください。");
  }
  if (!Array.isArray(result.writeResults) || result.writeResults.length !== prepared.length) {
    throw new Error("Firestore一括保存の応答件数が不一致。再実行前に本番データを確認してください。");
  }
  Logger.log(`Firestore一括保存成功: ${prepared.map(({ docId }) => docId).join(", ")}`);
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
