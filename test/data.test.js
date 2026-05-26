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
  id: "vol1-2-hello",
  word: "hello",
  meaning: "こんにちは",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[1], {
  id: "vol1-3-good,bye",
  word: "good,bye",
  meaning: "さようなら",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[2], {
  id: "vol1-4-quote\"test",
  word: "quote\"test",
  meaning: "テスト",
  sourceVol: "vol1"
});

console.log("All data parser tests passed.");
