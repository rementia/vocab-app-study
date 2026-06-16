import assert from "assert";
import { parseCsv, parseCsvToWords } from "../data.js";

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
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[1], {
  id: "good,bye",
  word: "good,bye",
  meaning: "さようなら",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[2], {
  id: "quote\"test",
  word: "quote\"test",
  meaning: "テスト",
  sourceVol: "vol1"
});

const sheetCsv = "word,meaning,level\ncreate,作る,1\nstudy,勉強する,2\n";
const parsedSheetWords = parseCsvToWords(sheetCsv, "vol2");
assert.deepStrictEqual(parsedSheetWords, [
  {
    id: "create",
    word: "create",
    meaning: "作る",
    sourceVol: "vol2"
  },
  {
    id: "study",
    word: "study",
    meaning: "勉強する",
    sourceVol: "vol2"
  }
], "parseCsvToWords should read word and meaning columns without mixing level into meaning");

console.log("All data parser tests passed.");
