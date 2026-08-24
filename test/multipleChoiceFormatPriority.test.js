import assert from "assert";
import { buildMultipleChoiceQuestion } from "../multipleChoice.js";

const keepOrder = (items) => items;

const wordsByVol = {
  vol1: [
    {
      id: "target",
      word: "target",
      meaning: "～を強く押す；～を動かす",
      sourceVol: "vol1",
      partOfSpeech: "verb",
      semanticCategory: "action_activity"
    },
    {
      id: "shape1",
      word: "shape1",
      meaning: "～を軽く引く；～を戻す",
      sourceVol: "vol1",
      partOfSpeech: "verb",
      semanticCategory: "action_activity"
    },
    {
      id: "shape2",
      word: "shape2",
      meaning: "～を速く運ぶ；～を移す",
      sourceVol: "vol1",
      partOfSpeech: "verb",
      semanticCategory: "action_activity"
    },
    {
      id: "shape3",
      word: "shape3",
      meaning: "～を静かに置く；～を離す",
      sourceVol: "vol1",
      partOfSpeech: "verb",
      semanticCategory: "action_activity"
    },
    {
      id: "short1",
      word: "short1",
      meaning: "進む",
      sourceVol: "vol1",
      partOfSpeech: "verb",
      semanticCategory: "action_activity"
    }
  ]
};

{
  const question = buildMultipleChoiceQuestion({
    current: wordsByVol.vol1[0],
    allWordsByVol: wordsByVol,
    volOrder: ["vol1"],
    translationMode: false,
    shuffle: keepOrder
  });

  assert.deepStrictEqual(
    question.options.map((option) => option.secondaryText),
    ["target", "shape1", "shape2", "shape3"],
    "word-to-meaning questions should prefer distractors with a similar meaning display shape inside the same metadata/volume tier"
  );
}

{
  const question = buildMultipleChoiceQuestion({
    current: wordsByVol.vol1[0],
    allWordsByVol: wordsByVol,
    volOrder: ["vol1"],
    translationMode: true,
    shuffle: keepOrder
  });

  assert.deepStrictEqual(
    question.options.map((option) => option.text),
    ["target", "shape1", "shape2", "shape3"],
    "meaning-to-word questions should preserve the existing metadata/volume order without applying Japanese meaning display-shape priority"
  );
}

console.log("All multiple-choice format-priority tests passed.");
