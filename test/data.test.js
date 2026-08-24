import assert from "assert";
import {
  fetchWordsForVol,
  formatFirestoreSyncValue,
  getWordDocSyncLabel,
  parseCsv,
  parseCsvToWords
} from "../data.js";

const EMPTY_PRONUNCIATION_FIELDS = {
  phonetic: "",
  pronunciationAudioUrl: "",
  pronunciationSource: "",
  pronunciationStatus: ""
};

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
  morpheme: "",
  morphemeMeaning: "",
  semanticDevelopment: "",
  partOfSpeech: "",
  semanticCategory: "",
  ...EMPTY_PRONUNCIATION_FIELDS,
  legacyWordKey: "hello",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[1], {
  id: "good,bye",
  word: "good,bye",
  meaning: "さようなら",
  morpheme: "",
  morphemeMeaning: "",
  semanticDevelopment: "",
  partOfSpeech: "",
  semanticCategory: "",
  ...EMPTY_PRONUNCIATION_FIELDS,
  legacyWordKey: "good,bye",
  sourceVol: "vol1"
});
assert.deepStrictEqual(parsedWords[2], {
  id: "quote\"test",
  word: "quote\"test",
  meaning: "テスト",
  morpheme: "",
  morphemeMeaning: "",
  semanticDevelopment: "",
  partOfSpeech: "",
  semanticCategory: "",
  ...EMPTY_PRONUNCIATION_FIELDS,
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
    morpheme: "",
    morphemeMeaning: "",
    semanticDevelopment: "",
    partOfSpeech: "",
    semanticCategory: "",
    ...EMPTY_PRONUNCIATION_FIELDS,
    legacyWordKey: "create",
    sourceVol: "vol2"
  },
  {
    id: "study",
    word: "study",
    meaning: "勉強する",
    morpheme: "",
    morphemeMeaning: "",
    semanticDevelopment: "",
    partOfSpeech: "",
    semanticCategory: "",
    ...EMPTY_PRONUNCIATION_FIELDS,
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
    morpheme: "",
    morphemeMeaning: "",
    semanticDevelopment: "",
    partOfSpeech: "",
    semanticCategory: "",
    ...EMPTY_PRONUNCIATION_FIELDS,
    legacyWordKey: "create",
    sourceVol: "vol3"
  },
  {
    id: "study",
    word: "study",
    meaning: "勉強する",
    morpheme: "",
    morphemeMeaning: "",
    semanticDevelopment: "",
    partOfSpeech: "",
    semanticCategory: "",
    ...EMPTY_PRONUNCIATION_FIELDS,
    legacyWordKey: "study",
    sourceVol: "vol3"
  }
], "parseCsvToWords should prefer stable id values and fall back to word when id is blank");

const morphemeCsv = "word,meaning,morpheme,morphemeMeaning,semanticDevelopment\ntransport,運ぶ,trans+port,across+carry,carry across a distance\nempty,空欄,,,\n";
const morphemeWords = parseCsvToWords(morphemeCsv, "vol4");
assert.deepStrictEqual(morphemeWords[0], {
  id: "transport",
  word: "transport",
  meaning: "運ぶ",
  morpheme: "trans+port",
  morphemeMeaning: "across+carry",
  semanticDevelopment: "carry across a distance",
  partOfSpeech: "",
  semanticCategory: "",
  ...EMPTY_PRONUNCIATION_FIELDS,
  legacyWordKey: "transport",
  sourceVol: "vol4"
}, "parseCsvToWords should read optional morpheme columns when present");
assert.strictEqual(morphemeWords[1].morpheme, "", "blank morpheme cells should remain safe empty strings");

const classificationCsv = "word,meaning,partOfSpeech,semanticCategory\nabandon,捨てる,verb,action_activity\n";
const classificationWords = parseCsvToWords(classificationCsv, "vol4");
assert.strictEqual(classificationWords[0].partOfSpeech, "verb", "partOfSpeech should be read when present");
assert.strictEqual(classificationWords[0].semanticCategory, "action_activity", "semanticCategory should be read when present");

const pronunciationCsv = [
  "word,meaning,phonetic,pronunciationAudioUrl,pronunciationSource,pronunciationStatus",
  "abandon,捨てる,əˈbændən,https://example.invalid/abandon.mp3,CMUdict,verified"
].join("\n");
const pronunciationWords = parseCsvToWords(pronunciationCsv, "vol4");
assert.deepStrictEqual(
  {
    phonetic: pronunciationWords[0].phonetic,
    pronunciationAudioUrl: pronunciationWords[0].pronunciationAudioUrl,
    pronunciationSource: pronunciationWords[0].pronunciationSource,
    pronunciationStatus: pronunciationWords[0].pronunciationStatus
  },
  {
    phonetic: "əˈbændən",
    pronunciationAudioUrl: "https://example.invalid/abandon.mp3",
    pronunciationSource: "CMUdict",
    pronunciationStatus: "verified"
  },
  "verified pronunciation fields should survive CSV parsing"
);

const fullContractCsv = [
  "id,word,meaning,morpheme,morphemeMeaning,semanticDevelopment,partOfSpeech,semanticCategory,phonetic,pronunciationAudioUrl,pronunciationSource,pronunciationStatus",
  "w_contract,contract,契約；～を契約する,con+tract,together+draw,draw together into an agreement,\"noun,verb\",communication,/ˈkɑːntrækt/,https://example.invalid/contract.mp3,Audited source,verified"
].join("\n");
const fullContractWord = parseCsvToWords(fullContractCsv, "vol3")[0];
assert.deepStrictEqual(
  {
    id: fullContractWord.id,
    word: fullContractWord.word,
    meaning: fullContractWord.meaning,
    morpheme: fullContractWord.morpheme,
    morphemeMeaning: fullContractWord.morphemeMeaning,
    semanticDevelopment: fullContractWord.semanticDevelopment,
    partOfSpeech: fullContractWord.partOfSpeech,
    semanticCategory: fullContractWord.semanticCategory,
    phonetic: fullContractWord.phonetic,
    pronunciationAudioUrl: fullContractWord.pronunciationAudioUrl,
    pronunciationSource: fullContractWord.pronunciationSource,
    pronunciationStatus: fullContractWord.pronunciationStatus,
    sourceVol: fullContractWord.sourceVol
  },
  {
    id: "w_contract",
    word: "contract",
    meaning: "契約；～を契約する",
    morpheme: "con+tract",
    morphemeMeaning: "together+draw",
    semanticDevelopment: "draw together into an agreement",
    partOfSpeech: "noun,verb",
    semanticCategory: "communication",
    phonetic: "/ˈkɑːntrækt/",
    pronunciationAudioUrl: "https://example.invalid/contract.mp3",
    pronunciationSource: "Audited source",
    pronunciationStatus: "verified",
    sourceVol: "vol3"
  },
  "all spreadsheet-derived learning fields must survive the Firestore CSV -> app parser contract"
);

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
