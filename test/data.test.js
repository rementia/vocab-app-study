import assert from "assert";
import {
  fetchWordsForVol,
  formatFirestoreSyncValue,
  getWordDocSyncLabel,
  parseCsv,
  parseCsvToWords
} from "../data.js";

const sampleCsv = `\ufeffword,meaning\r\nhello,こんにちは\r\n"good,bye","さようなら"\r\n"quote""test",テスト\r\n`;

const expectedRows = [
  ["word", "meaning"],
  ["hello", "こんにちは"],
  ["good,bye", "さようなら"],
  ["quote\"test", "テスト"]
];

const parsedRows = parseCsv(sampleCsv);
assert.deepStrictEqual(parsedRows, expectedRows, "parseCsv should correctly parse quoted CSV rows and normalize line endings");

const parsedWords = parseCsvToWords(sampleCsv, "vol1");
assert.strictEqual(parsedWords.length, 3, "parseCsvToWords should skip header rows and return only data rows");
assert.deepStrictEqual(parsedWords[0], {
  id: "hello",
  word: "hello",
  meaning: "こんにちは",
  legacyWordKey: "hello",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[1], {
  id: "good,bye",
  word: "good,bye",
  meaning: "さようなら",
  legacyWordKey: "good,bye",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[2], {
  id: "quote\"test",
  word: "quote\"test",
  meaning: "テスト",
  legacyWordKey: "quote\"test",
  sourceVol: "vol1"
});

const sheetCsv = "word,meaning,level\ncreate,作る,1\nstudy,勉強する,2\n";
const parsedSheetWords = parseCsvToWords(sheetCsv, "vol2");
assert.deepStrictEqual(parsedSheetWords, [
  {
    id: "create",
    word: "create",
    meaning: "作る",
    legacyWordKey: "create",
    sourceVol: "vol2"
  },
  {
    id: "study",
    word: "study",
    meaning: "勉強する",
    legacyWordKey: "study",
    sourceVol: "vol2"
  }
], "parseCsvToWords should fall back to word-derived ids when id column is missing");

const stableIdCsv = "id,word,meaning,level\nw_abcd1234,create,作る,1\n,study,勉強する,2\n";
const stableIdWords = parseCsvToWords(stableIdCsv, "vol3");
assert.deepStrictEqual(stableIdWords, [
  {
    id: "w_abcd1234",
    word: "create",
    meaning: "作る",
    legacyWordKey: "create",
    sourceVol: "vol3"
  },
  {
    id: "study",
    word: "study",
    meaning: "勉強する",
    legacyWordKey: "study",
    sourceVol: "vol3"
  }
], "parseCsvToWords should prefer stable id values and fall back to word when id is blank");

assert.strictEqual(
  formatFirestoreSyncValue(new Date("2026-06-20T00:00:00.000Z")),
  "2026-06-20T00:00:00.000Z",
  "Date sync metadata should be formatted as ISO text"
);

assert.strictEqual(
  formatFirestoreSyncValue({ seconds: 1781913600, nanoseconds: 0 }),
  "2026-06-20T00:00:00.000Z",
  "Firestore timestamp-like sync metadata should be formatted as ISO text"
);

assert.strictEqual(
  getWordDocSyncLabel({ csv: "word,meaning\n", syncedAt: "manual-sync" }),
  "manual-sync",
  "syncedAt should be used when present"
);

assert.strictEqual(
  getWordDocSyncLabel({ csv: "word,meaning\n" }),
  "",
  "missing sync metadata should not fail"
);

assert.strictEqual(
  typeof fetchWordsForVol,
  "function",
  "fetchWordsForVol should remain available as the compatible word-array API"
);

console.log("All data parser tests passed.");