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
  const sheets = Object.entries(rowsBySheet).map(([name, rows], index) => ({
    getName: () => name,
    getSheetId: () => index + 1,
    getDataRange: () => ({
      getDisplayValues: () => rows.map((row) => [...row])
    }),
    getRange: (row, col) => ({
      setValue(value) {
        writes.push({ sheet: name, row, col, value });
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
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    Logger: { log: (message) => logs.push(String(message)) },
    Utilities: {
      newBlob: (data) => ({
        getBytes: () => [...Buffer.from(String(data), "utf8")]
      })
    }
  });
  runInContext(script, context, { filename: "Code.gs" });
  return {
    rows: rowsBySheet["シート1"],
    rowsBySheet,
    writes,
    logs,
    setMode: (mode) => runInContext(`CONFIG.mode = ${JSON.stringify(mode)}`, context),
    preview: () => runInContext("buildGroupedRows({ preview: true })", context),
    regular: () => runInContext("buildGroupedRows()", context),
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
  assert.throws(() => fixture.regular(), /分類情報が全件空/);
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

console.log("Apps Script dryRun read-only regression tests passed.");
