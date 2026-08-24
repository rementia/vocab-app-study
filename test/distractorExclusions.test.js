import assert from "assert";
import { shareDistractorExclusionGroup } from "../distractorExclusions.js";
import { collectMultipleChoiceDistractors } from "../multipleChoice.js";

{
  const abhor = { id: "w_mag9ma3021n1" };
  const detest = { id: "w_27g5ewxgepf0" };
  const envy = { id: "unrelated" };
  assert.strictEqual(shareDistractorExclusionGroup(abhor, detest), true);
  assert.strictEqual(shareDistractorExclusionGroup(abhor, envy), false);
}

{
  const words = {
    vol1: [
      { id: "expressway", word: "expressway", meaning: "高速道路", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "place" },
      { id: "motorway", word: "motorway", meaning: "高速道路（英）", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "place" },
      { id: "station", word: "station", meaning: "駅", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "place" }
    ]
  };
  const distractors = collectMultipleChoiceDistractors({
    current: words.vol1[0],
    allWordsByVol: words,
    volOrder: ["vol1"],
    translationMode: true
  });
  assert.deepStrictEqual(distractors.map((item) => item.word), ["station"]);
}

{
  const words = {
    vol1: [
      { id: "a", word: "a", meaning: "～を悩ませる", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "behavior" },
      { id: "b", word: "b", meaning: "悩ませる", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "behavior" },
      { id: "c", word: "c", meaning: "助ける", sourceVol: "vol1", partOfSpeech: "verb", semanticCategory: "behavior" }
    ]
  };
  const distractors = collectMultipleChoiceDistractors({
    current: words.vol1[0],
    allWordsByVol: words,
    volOrder: ["vol1"],
    translationMode: false
  });
  assert.deepStrictEqual(distractors.map((item) => item.word), ["c"]);
}

console.log("All distractor exclusion tests passed.");
