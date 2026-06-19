import assert from "assert";
import {
  buildMultipleChoiceQuestion,
  collectMultipleChoiceDistractors
} from "../multipleChoice.js";

const wordsByVol = {
  vol1: [
    { id: "abandon", word: "abandon", meaning: "捨てる", sourceVol: "vol1" },
    { id: "expand", word: "expand", meaning: "拡大する", sourceVol: "vol1" },
    { id: "permit", word: "permit", meaning: "許可する", sourceVol: "vol1" },
    { id: "protect", word: "protect", meaning: "保護する", sourceVol: "vol1" },
    { id: "guard", word: "guard", meaning: "保護する", sourceVol: "vol1" }
  ],
  vol2: [
    { id: "create", word: "create", meaning: "作る", sourceVol: "vol2" }
  ]
};
const volOrder = ["vol1", "vol2"];
const keepOrder = (items) => items;

{
  const question = buildMultipleChoiceQuestion({
    current: wordsByVol.vol1[0],
    allWordsByVol: wordsByVol,
    volOrder,
    translationMode: false,
    shuffle: keepOrder
  });

  assert.strictEqual(question.prompt, "abandon");
  assert.strictEqual(question.correctText, "捨てる");
  assert.strictEqual(question.direction, "word-to-meaning");
  assert.strictEqual(question.options.length, 4);
  assert.strictEqual(question.options.filter((option) => option.isCorrect).length, 1);
  assert.deepStrictEqual(
    question.options.map((option) => option.text),
    ["捨てる", "拡大する", "許可する", "保護する"]
  );
  assert.deepStrictEqual(
    question.options.map((option) => option.secondaryText),
    ["abandon", "expand", "permit", "protect"]
  );
}

{
  const question = buildMultipleChoiceQuestion({
    current: wordsByVol.vol1[0],
    allWordsByVol: wordsByVol,
    volOrder,
    translationMode: true,
    shuffle: keepOrder
  });

  assert.strictEqual(question.prompt, "捨てる");
  assert.strictEqual(question.correctText, "abandon");
  assert.strictEqual(question.direction, "meaning-to-word");
  assert.deepStrictEqual(
    question.options.map((option) => option.text),
    ["abandon", "expand", "permit", "protect"]
  );
  assert.deepStrictEqual(
    question.options.map((option) => option.secondaryText),
    ["捨てる", "拡大する", "許可する", "保護する"]
  );
}

{
  const distractors = collectMultipleChoiceDistractors({
    current: wordsByVol.vol1[3],
    allWordsByVol: wordsByVol,
    volOrder,
    translationMode: false
  });

  assert.deepStrictEqual(
    distractors.map((item) => item.meaning),
    ["捨てる", "拡大する", "許可する", "作る"],
    "same displayed choice text and correct text should be excluded, then fallback words should fill candidates"
  );
}

console.log("All multiple choice tests passed.");
