import assert from "assert";
import { auditMultipleChoiceQuality } from "../multipleChoiceQualityAudit.js";

const words = [
  { id: "a", word: "alpha", meaning: "～を強く押す；～を動かす", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "action_activity" },
  { id: "b", word: "bravo", meaning: "～を軽く引く；～を戻す", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "action_activity" },
  { id: "c", word: "charlie", meaning: "～を速く運ぶ；～を移す", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "action_activity" },
  { id: "d", word: "delta", meaning: "～を静かに置く；～を離す", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "action_activity" },
  { id: "e", word: "echo", meaning: "進む", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "action_activity" }
];

const report = auditMultipleChoiceQuality(words);
assert.strictEqual(report.totalWords, 5);
assert.strictEqual(report.formatReady.some((item) => item.word === "alpha"), true);
assert.strictEqual(report.duplicateMeaningGroupCount, 0);

const duplicateReport = auditMultipleChoiceQuality([
  ...words,
  { id: "f", word: "foxtrot", meaning: "進む", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "action_activity" }
]);
assert.strictEqual(duplicateReport.duplicateMeaningGroupCount, 1);

console.log("All multiple-choice quality audit tests passed.");
