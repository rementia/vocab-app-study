import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInContext, createContext } from "node:vm";

const script = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

function createFixture(initialRows) {
  const inputBySheet = Array.isArray(initialRows)
    ? { "シート1": initialRows }
    : initialRows;
  const rowsBySheet = Object.fromEntries(
    Object.entries(inputBySheet).map(([name, rows]) => [
      name,
      rows.map((row) => [...row])
    ])
  );
  const writes = [];
  const logs = [];
  const requests = [];
  const responseState = { status: 200, body: null };
  const authProps = { syncToken: null };
  let failOnWriteNumber = null;
  let fakeSuccessOnWriteNumber = null;
  let writeAttempts = 0;
  let injectOnCellRead = null;
  const lockState = { locked: false, contended: false, tries: 0, releases: 0 };
  const sheets = Object.entries(rowsBySheet).map(([name, rows], index) => ({
    getName: () => name,
    getSheetId: () => index + 1,
    getDataRange: () => ({
      getDisplayValues: () => rows.map((row) => [...row])
    }),
    getRange: (row, col) => ({
      getDisplayValue() {
        if (injectOnCellRead && injectOnCellRead.row === row && injectOnCellRead.col === col) {
          while (rows[row - 1].length < col) rows[row - 1].push("");
          rows[row - 1][col - 1] = injectOnCellRead.value;
          injectOnCellRead = null;
        }
        return String(rows[row - 1]?.[col - 1] ?? "");
      },
      setValue(value) {
        writeAttempts++;
        if (writeAttempts === failOnWriteNumber) {
          throw new Error("simulated Sheets write failure");
        }
        writes.push({ sheet: name, row, col, value });
        if (writeAttempts === fakeSuccessOnWriteNumber) return;
        while (rows[row - 1].length < col) rows[row - 1].push("");
        rows[row - 1][col - 1] = value;
      }
    })
  }));
  const spreadsheet = {
    getSheets: () => sheets,
    getSheetByName: (name) => sheets.find((sheet) => sheet.getName() === name) || null
  };
  const context = createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, flush: () => {} },
    LockService: { getScriptLock: () => ({
      tryLock(timeoutMs) {
        assert.equal(timeoutMs, 30000);
        lockState.tries++;
        if (lockState.contended || lockState.locked) return false;
        lockState.locked = true;
        return true;
      },
      releaseLock() {
        assert.equal(lockState.locked, true, "must only release acquired lock");
        lockState.locked = false;
        lockState.releases++;
      }
    }) },
    Logger: { log: (message) => logs.push(String(message)) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => key === "SYNC_TOKEN" ? authProps.syncToken : null
    }) },
    UrlFetchApp: { fetch: (url, options) => {
      requests.push({ url, options });
      const count = JSON.parse(options.payload).writes.length;
      return {
        getResponseCode: () => responseState.status,
        getContentText: () => responseState.body ?? JSON.stringify({
          writeResults: Array.from({ length: count }, () => ({ updateTime: "2026-10-12T00:00:00Z" })),
          commitTime: "2026-10-12T00:00:00Z"
        })
      };
    } },
    Utilities: {
      newBlob: (data) => ({
        getBytes: () => [...Buffer.from(String(data), "utf8")]
      })
    }
  });
  runInContext(script, context, { filename: "Code.gs" });
  // The Apps Script credential exchanger is out of scope for Firestore REST tests.
  runInContext('getAccessToken = () => "mock_access_token"', context);
  return {
    rows: rowsBySheet["シート1"],
    rowsBySheet,
    writes,
    logs,
    requests,
    lockState,
    holdLock: (isHeld) => { lockState.contended = isHeld; },
    setExpectedSyncToken: (value) => { authProps.syncToken = value; },
    validateWebSyncToken: (token) => runInContext(
      `validateSyncToken(${JSON.stringify({ postData: { contents: JSON.stringify({ token }) } })})`,
      context
    ),
    failOnWrite: (number) => { failOnWriteNumber = number; },
    fakeSuccessOnWrite: (number) => { fakeSuccessOnWriteNumber = number; },
    injectAtPrewriteRead: (row, col, value) => { injectOnCellRead = { row, col, value }; },
    setResponse: (status, body = null) => { responseState.status = status; responseState.body = body; },
    setMode: (mode) => runInContext(`CONFIG.mode = ${JSON.stringify(mode)}`, context),
    preview: () => runInContext("buildGroupedRows({ preview: true })", context),
    regular: () => runInContext("buildGroupedRows()", context),
    syncAll: () => runInContext("syncAllVolumesToFirestore()", context),
    syncOne: (docId) => runInContext(`syncOneVolume(${JSON.stringify(docId)})`, context),
    dryRun: () => runInContext("dryRun()", context)
  };
}

const columns = ["word", "meaning", "level", "partOfSpeech", "semanticCategory"];
const exampleRows = [
  columns,
  ["abandon", "捨てる", "1", "verb", "action"],
  ["expand", "広がる", "2", "verb", "change"]
];

// dryRun must not add an ID column or write generated IDs to the source sheet.
{
  const fixture = createFixture(exampleRows);
  const before = JSON.stringify(fixture.rows);
  fixture.dryRun();
  assert.equal(JSON.stringify(fixture.rows), before);
  assert.equal(fixture.writes.length, 0);
  assert.ok(fixture.logs.some((log) => log.includes("変更していません")));
  const preview = fixture.preview();
  assert.equal(preview.vol1.length, 2);
  assert.equal(preview.vol2.length, 2);
  assert.match(preview.vol1[1][0], /^w_[a-z0-9]{12}$/);
  assert.equal(fixture.writes.length, 0);
}

// The existing production sync path must still persist stable IDs.
{
  const fixture = createFixture(exampleRows);
  const result = fixture.regular();
  assert.equal(fixture.rows[0][5], "id");
  assert.equal(fixture.writes.length, 3);
  assert.equal(result.vol1[1][0], fixture.rows[1][5]);
  assert.equal(result.vol2[1][0], fixture.rows[2][5]);
  assert.notEqual(result.vol1[1][0], result.vol2[1][0]);
}

// Existing IDs are preserved, and blank IDs are only simulated during preview.
{
  const fixture = createFixture([
    [...columns, "id"],
    [...exampleRows[1], "w_existing"],
    [...exampleRows[2], ""]
  ]);
  const before = JSON.stringify(fixture.rows);
  const preview = fixture.preview();
  assert.equal(preview.vol1[1][0], "w_existing");
  assert.match(preview.vol2[1][0], /^w_[a-z0-9]{12}$/);
  assert.equal(JSON.stringify(fixture.rows), before);
  assert.equal(fixture.writes.length, 0);
}

// Duplicated IDs must fail without any mutation.
{
  const fixture = createFixture([
    [...columns, "id"],
    [...exampleRows[1], "w_duplicate"],
    [...exampleRows[2], "w_duplicate"]
  ]);
  const before = JSON.stringify(fixture.rows);
  assert.throws(() => fixture.dryRun(), /重複id/);
  assert.equal(JSON.stringify(fixture.rows), before);
  assert.equal(fixture.writes.length, 0);
}

// Four separate volume sheets must also be read-only during dryRun.
{
  const headers = ["word", "meaning", "partOfSpeech", "semanticCategory"];
  const fixture = createFixture({
    vol1: [headers, ["abandon", "捨てる", "verb", "action"]],
    vol2: [[...headers, "id"], ["expand", "広がる", "verb", "change", "w_existing"]],
    vol3: [headers, ["", "", "", ""], ["coherent", "筋の通った", "adjective", "quality"]],
    vol4: [headers, ["ephemeral", "一時的な", "adjective", "quality"]]
  });
  fixture.setMode("sheetsByVolume");
  const before = JSON.stringify(fixture.rowsBySheet);
  fixture.dryRun();
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
  assert.equal(fixture.writes.length, 0);
  const preview = fixture.preview();
  assert.deepStrictEqual(
    ["vol1", "vol2", "vol3", "vol4"].map((vol) => preview[vol].length),
    [2, 2, 2, 2]
  );
  assert.equal(preview.vol2[1][4], "w_existing");
  assert.match(preview.vol3[1][4], /^w_[a-z0-9]{12}$/);
  assert.equal(fixture.writes.length, 0);

  // The real sync path still persists missing IDs without overwriting existing IDs.
  const actual = fixture.regular();
  assert.ok(fixture.writes.length > 0);
  assert.equal(actual.vol2[1][4], "w_existing");
  assert.equal(actual.vol3[1][4], fixture.rowsBySheet.vol3[2][4]);
  assert.equal(actual.vol1[1][4], fixture.rowsBySheet.vol1[1][4]);
}

// Failed validation in dryRun must never modify any source sheet.
{
  const fixture = createFixture({
    vol1: [
      ["word", "meaning", "partOfSpeech", "semanticCategory", "id"],
      ["abandon", "捨てる", "verb", "action", "w_duplicate"]
    ],
    vol2: [
      ["word", "meaning", "partOfSpeech", "semanticCategory", "id"],
      ["expand", "広がる", "verb", "change", "w_duplicate"]
    ],
    vol3: [["word", "meaning", "partOfSpeech", "semanticCategory"]],
    vol4: [["word", "meaning", "partOfSpeech", "semanticCategory"]]
  });
  fixture.setMode("sheetsByVolume");
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.dryRun(), /重複id/);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
  assert.equal(fixture.writes.length, 0);
}

// Real sync must NOT mutate Sheets when ID validation fails after ID generation.
{
  const fixture = createFixture([
    [...columns, "id"],
    [...exampleRows[1], ""],
    [...exampleRows[2], "w_duplicate"],
    ["candid", "率直な", "2", "adjective", "quality", "w_duplicate"]
  ]);
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.regular(), /重複id/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// Cross-volume duplicate discovered late must not leave partial IDs in vol1.
{
  const headers = ["word", "meaning", "partOfSpeech", "semanticCategory", "id"];
  const fixture = createFixture({
    vol1: [headers, ["abandon", "捨てる", "verb", "action", ""]],
    vol2: [headers, ["expand", "広がる", "verb", "change", "w_duplicate"]],
    vol3: [headers, ["candid", "率直な", "adjective", "quality", "w_duplicate"]],
    vol4: [headers, ["ephemeral", "一時的な", "adjective", "quality", ""]]
  });
  fixture.setMode("sheetsByVolume");
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.regular(), /重複id/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// Late classification failure must not leave new IDs on a different volume.
{
  const fixture = createFixture([
    columns,
    [...exampleRows[1]],
    ["expand", "広がる", "2", "", ""]
  ]);
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.regular(), /が全件空/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// Missing volume source must fail before any modifications to earlier volumes.
{
  const fixture = createFixture({
    vol1: [
      ["word", "meaning", "partOfSpeech", "semanticCategory"],
      ["abandon", "捨てる", "verb", "action"]
    ]
  });
  fixture.setMode("sheetsByVolume");
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.regular(), /シートが見つかりません/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// A typo in level must abort rather than silently remove that word from Firestore.
for (const invalidLevel of ["vol9", "", "unassigned"]) {
  const fixture = createFixture([
    columns,
    [...exampleRows[1]],
    ["candid", "率直な", invalidLevel, "adjective", "quality"],
    [...exampleRows[2]]
  ]);
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.dryRun(), /未対応のlevel/);
  assert.throws(() => fixture.regular(), /未対応のlevel/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// Full sync must reject a zero-word volume before modifying Sheets or Firestore.
{
  const fixture = createFixture(exampleRows);
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.syncAll(), /vol3: 単語数が0件/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
  // A single-volume sync must reject the empty requested volume too.
  assert.throws(() => fixture.syncOne("vol4"), /vol4: 単語数が0件/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// If the last separate volume sheet becomes header-only, do not persist
// prepared IDs into any of the earlier sheets.
{
  const headers = ["word", "meaning", "partOfSpeech", "semanticCategory"];
  const fixture = createFixture({
    vol1: [headers, ["abandon", "捨てる", "verb", "action"]],
    vol2: [headers, ["expand", "広がる", "verb", "change"]],
    vol3: [headers, ["candid", "率直な", "adjective", "quality"]],
    vol4: [headers]
  });
  fixture.setMode("sheetsByVolume");
  const before = JSON.stringify(fixture.rowsBySheet);
  assert.throws(() => fixture.syncAll(), /vol4: 単語数が0件/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(JSON.stringify(fixture.rowsBySheet), before);
}

// Full sync must emit one atomic Firestore Commit with all four masked writes.
{
  const headers = ["word", "meaning", "partOfSpeech", "semanticCategory", "id"];
  const fixture = createFixture({
    vol1: [headers, ["abandon", "捨てる", "verb", "action", "w_one"]],
    vol2: [headers, ["expand", "広がる", "verb", "change", "w_two"]],
    vol3: [headers, ["candid", "率直な", "adjective", "quality", "w_three"]],
    vol4: [headers, ["ephemeral", "一時的な", "adjective", "quality", "w_four"]]
  });
  fixture.setMode("sheetsByVolume");
  const summary = fixture.syncAll();
  assert.equal(summary.volumes.length, 4);
  assert.equal(fixture.requests.length, 1);
  const { url, options } = fixture.requests[0];
  assert.match(url, /\/documents:commit$/);
  assert.equal(options.method, "post");
  const payload = JSON.parse(options.payload);
  assert.equal(payload.writes.length, 4);
  assert.deepStrictEqual(
    payload.writes.map(({ update }) => update.name.split("/").pop()),
    ["vol1", "vol2", "vol3", "vol4"]
  );
  assert.ok(payload.writes.every(({ updateMask }) => (
    updateMask.fieldPaths.includes("csv") &&
    updateMask.fieldPaths.includes("csvGzipBase64") &&
    updateMask.fieldPaths.includes("syncedAt")
  )));
  assert.ok(payload.writes.every(({ update }) => update.fields.csv.stringValue.includes("w_")));
  assert.equal(fixture.writes.length, 0);
}

// A failed atomic commit is surfaced, and no fallback per-volume PATCH is sent.
{
  const fixture = createFixture({
    vol1: [["word", "meaning", "partOfSpeech", "semanticCategory", "id"], ["a", "x", "noun", "object", "w_a"]],
    vol2: [["word", "meaning", "partOfSpeech", "semanticCategory", "id"], ["b", "y", "noun", "object", "w_b"]],
    vol3: [["word", "meaning", "partOfSpeech", "semanticCategory", "id"], ["c", "z", "noun", "object", "w_c"]],
    vol4: [["word", "meaning", "partOfSpeech", "semanticCategory", "id"], ["d", "w", "noun", "object", "w_d"]]
  });
  fixture.setMode("sheetsByVolume");
  fixture.setResponse(403, "{\"error\":\"access denied\"}");
  assert.throws(() => fixture.syncAll(), /Firestore一括保存失敗: HTTP 403/);
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.requests[0].options.method, "post");
}

// Unexpected success responses must not be misreported as a fully verified sync.
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory", "id"],
    ["abandon", "捨てる", "1", "verb", "action", "w_a"],
    ["expand", "広がる", "2", "verb", "change", "w_b"]
  ]);
  fixture.setResponse(200, "{}");
  assert.throws(() => fixture.syncOne("vol1"), /応答件数が不一致/);
  assert.equal(fixture.requests.length, 1);
}

// Simulated failure partway through saving new IDs must prevent Firestore commit.
{
  const headers = ["word", "meaning", "level", "partOfSpeech", "semanticCategory"];
  const fixture = createFixture([
    headers,
    ["alpha", "A", "1", "noun", "thing"],
    ["beta", "B", "2", "noun", "thing"],
    ["gamma", "C", "3", "noun", "thing"],
    ["delta", "D", "4", "noun", "thing"]
  ]);
  fixture.failOnWrite(3);
  assert.throws(() => fixture.syncAll(), /ID保存検証失敗.*Firestoreには未同期/);
  assert.equal(fixture.requests.length, 0);
  // The earlier header and first new ID may be saved, but Firestore is unchanged.
  assert.equal(fixture.writes.length, 2);
}

// A silent Sheets write failure must be detected by reading the cell back.
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory", "id"],
    ["alpha", "A", "1", "noun", "thing", ""],
    ["beta", "B", "2", "noun", "thing", ""],
    ["gamma", "C", "3", "noun", "thing", ""],
    ["delta", "D", "4", "noun", "thing", ""]
  ]);
  fixture.fakeSuccessOnWrite(2);
  assert.throws(() => fixture.syncAll(), /書込後のIDが一致しません/);
  assert.equal(fixture.requests.length, 0);
}

// A concurrent write after the source snapshot must be detected in preflight,
// before ANY generated ID is written or any Firestore request is sent.
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory", "id"],
    ["alpha", "A", "1", "noun", "thing", ""],
    ["beta", "B", "2", "noun", "thing", ""],
    ["gamma", "C", "3", "noun", "thing", ""],
    ["delta", "D", "4", "noun", "thing", ""]
  ]);
  fixture.injectAtPrewriteRead(4, 6, "w_concurrent");
  assert.throws(() => fixture.syncAll(), /ID書込先が既に変更されています/);
  assert.equal(fixture.writes.length, 0);
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.rowsBySheet["シート1"][3][5], "w_concurrent");
}

// All Firestore synchronization routes must use and release the same script lock.
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory", "id"],
    ["alpha", "A", "1", "noun", "thing", "w_one"],
    ["beta", "B", "2", "noun", "thing", "w_two"],
    ["gamma", "C", "3", "noun", "thing", "w_three"],
    ["delta", "D", "4", "noun", "thing", "w_four"]
  ]);
  fixture.syncAll();
  fixture.syncOne("vol1");
  assert.equal(fixture.lockState.tries, 2);
  assert.equal(fixture.lockState.releases, 2);
  assert.equal(fixture.lockState.locked, false);
  assert.equal(fixture.requests.length, 2);
}

// Lock contention must abort before any source writes or Firestore requests.
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory"],
    ["alpha", "A", "1", "noun", "thing"],
    ["beta", "B", "2", "noun", "thing"],
    ["gamma", "C", "3", "noun", "thing"],
    ["delta", "D", "4", "noun", "thing"]
  ]);
  fixture.holdLock(true);
  assert.throws(() => fixture.syncAll(), /別の語彙同期処理が実行中/);
  assert.equal(fixture.lockState.tries, 1);
  assert.equal(fixture.lockState.releases, 0);
  assert.equal(fixture.writes.length, 0);
  assert.equal(fixture.requests.length, 0);
}

// A failed Sheets write / failed Firestore commit must still release the lock.
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory"],
    ["alpha", "A", "1", "noun", "thing"],
    ["beta", "B", "2", "noun", "thing"],
    ["gamma", "C", "3", "noun", "thing"],
    ["delta", "D", "4", "noun", "thing"]
  ]);
  fixture.failOnWrite(2);
  assert.throws(() => fixture.syncAll(), /ID保存検証失敗/);
  assert.equal(fixture.lockState.releases, 1);
  assert.equal(fixture.lockState.locked, false);
}
{
  const fixture = createFixture([
    ["word", "meaning", "level", "partOfSpeech", "semanticCategory", "id"],
    ["alpha", "A", "1", "noun", "thing", "w_one"],
    ["beta", "B", "2", "noun", "thing", "w_two"],
    ["gamma", "C", "3", "noun", "thing", "w_three"],
    ["delta", "D", "4", "noun", "thing", "w_four"]
  ]);
  fixture.setResponse(500);
  assert.throws(() => fixture.syncAll(), /Firestore一括保存失敗/);
  assert.equal(fixture.lockState.releases, 1);
  assert.equal(fixture.lockState.locked, false);
}

// Deprecated Web App synchronization remains fail-closed after SYNC_TOKEN deletion.
// These are mock tests: they do not establish which script version is live.
{
  const fixture = createFixture(exampleRows);
  assert.throws(
    () => fixture.validateWebSyncToken("historically_exposed_value"),
    /SYNC_TOKEN が設定されていません/
  );
  fixture.setExpectedSyncToken("server_only_test_token");
  assert.throws(
    () => fixture.validateWebSyncToken("historically_exposed_value"),
    /Invalid token/
  );
  assert.doesNotThrow(() => fixture.validateWebSyncToken("server_only_test_token"));
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.writes.length, 0);
}

console.log("Apps Script revoked token fail-closed regression tests passed.");

console.log("Apps Script synchronization lock regression tests passed.");

console.log("Apps Script generated ID persistence checks passed.");

console.log("Apps Script atomic Firestore commit regression tests passed.");
console.log("Apps Script dryRun read-only regression tests passed.");
