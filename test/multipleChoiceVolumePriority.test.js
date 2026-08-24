import assert from "assert";
import { buildMultipleChoiceQuestion } from "../multipleChoice.js";

const keepOrder = (items) => items;

const wordsByVol = {
  vol1: [
    { id: "target", word: "target", meaning: "対象", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "local1", word: "local1", meaning: "地元候補1", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "local2", word: "local2", meaning: "地元候補2", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "local3", word: "local3", meaning: "地元候補3", sourceVol: "vol1", partOfSpeech: "noun", semanticCategory: "object" }
  ],
  vol2: [
    { id: "remote1", word: "remote1", meaning: "別巻候補1", sourceVol: "vol2", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "remote2", word: "remote2", meaning: "別巻候補2", sourceVol: "vol2", partOfSpeech: "noun", semanticCategory: "object" },
    { id: "remote3", word: "remote3", meaning: "別巻候補3", sourceVol: "vol2", partOfSpeech: "noun", semanticCategory: "object" }
  ]
};

const question = buildMultipleChoiceQuestion({
  current: wordsByVol.vol1[0],
  allWordsByVol: wordsByVol,
  volOrder: ["vol1", "vol2"],
  translationMode: false,
  shuffle: keepOrder
});

assert.deepStrictEqual(
  question.options.map((option) => option.secondaryText),
  ["target", "local1", "local2", "local3"],
  "same metadata priority should prefer distractors from the current volume before other volumes"
);

console.log("All multiple-choice volume-priority tests passed.");
