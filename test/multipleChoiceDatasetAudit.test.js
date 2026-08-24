import assert from "node:assert";
import {
  auditMultipleChoiceDataset,
  hasStrongPartOfSpeechMismatch
} from "../multipleChoiceDatasetAudit.js";

const healthyWords = [
  { id: "a", word: "alpha", meaning: "物A", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
  { id: "b", word: "bravo", meaning: "物B", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
  { id: "c", word: "charlie", meaning: "物C", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
  { id: "d", word: "delta", meaning: "物D", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" }
];

{
  const report = auditMultipleChoiceDataset(healthyWords);
  assert.strictEqual(report.invalidRows.length, 0);
  assert.strictEqual(report.duplicateIds.length, 0);
  assert.strictEqual(report.duplicateWords.length, 0);
  assert.strictEqual(report.invalidVolumes.length, 0);
  assert.strictEqual(report.partOfSpeechMismatches.length, 0);
  assert.strictEqual(report.directions.wordToMeaning.insufficient.length, 0);
  assert.strictEqual(report.directions.meaningToWord.insufficient.length, 0);
  assert.deepStrictEqual(report.directions.wordToMeaning.tierCounts, [4, 0, 0, 0]);
  assert.deepStrictEqual(report.directions.meaningToWord.tierCounts, [4, 0, 0, 0]);
}

{
  assert.strictEqual(
    hasStrongPartOfSpeechMismatch({
      word: "ambush",
      meaning: "待ち伏せ、奇襲；～を待ち伏せする",
      partOfSpeech: "noun"
    }),
    true
  );
  assert.strictEqual(
    hasStrongPartOfSpeechMismatch({
      word: "adhesive",
      meaning: "接着性の；接着剤",
      partOfSpeech: "adjective"
    }),
    true
  );
  assert.strictEqual(
    hasStrongPartOfSpeechMismatch({
      word: "chief",
      meaning: "長、責任者；主要な、最も重要な",
      partOfSpeech: "noun"
    }),
    false,
    "precision-first advisory heuristic should not infer noun-to-adjective mismatch from Japanese gloss shape alone"
  );
  assert.strictEqual(
    hasStrongPartOfSpeechMismatch({
      word: "overhead",
      meaning: "頭上に、頭上の；間接費、諸経費",
      partOfSpeech: "adverb"
    }),
    true
  );
  assert.strictEqual(
    hasStrongPartOfSpeechMismatch({
      word: "cloak",
      meaning: "マント；覆い、隠れみの",
      partOfSpeech: "noun"
    }),
    false
  );
  assert.strictEqual(
    hasStrongPartOfSpeechMismatch({
      word: "corps",
      meaning: "軍団、部隊；～団",
      partOfSpeech: "noun"
    }),
    false
  );
}

{
  const invalidVolumeWords = healthyWords.map((item) => ({ ...item }));
  invalidVolumeWords[0].sourceVol = "vol5";
  const report = auditMultipleChoiceDataset(invalidVolumeWords);
  assert.deepStrictEqual(report.invalidVolumes.map((item) => item.word), ["alpha"]);
}

{
  const fallbackWords = [
    { id: "target", word: "target", meaning: "対象", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "emotion" },
    { id: "w", word: "wword", meaning: "物W", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "x", word: "xword", meaning: "物X", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "y", word: "yword", meaning: "物Y", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "z", word: "zword", meaning: "物Z", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" }
  ];
  const report = auditMultipleChoiceDataset(fallbackWords);
  assert.deepStrictEqual(
    report.directions.wordToMeaning.priority3Required.map((item) => item.word),
    ["target"]
  );
  assert.deepStrictEqual(
    report.directions.meaningToWord.priority3Required.map((item) => item.word),
    ["target"]
  );
}

console.log("All multiple-choice dataset audit tests passed.");
