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

{
  const classifiedWordsByVol = {
    vol1: [
      {
        id: "abandon",
        word: "abandon",
        meaning: "捨てる",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      },
      {
        id: "chair",
        word: "chair",
        meaning: "椅子",
        sourceVol: "vol1",
        partOfSpeech: "noun",
        semanticCategory: "object"
      },
      {
        id: "expand",
        word: "expand",
        meaning: "拡大する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "change"
      },
      {
        id: "perform",
        word: "perform",
        meaning: "実行する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      }
    ]
  };
  const distractors = collectMultipleChoiceDistractors({
    current: classifiedWordsByVol.vol1[0],
    allWordsByVol: classifiedWordsByVol,
    volOrder: ["vol1"],
    translationMode: false
  });

  assert.deepStrictEqual(
    distractors.map((item) => item.word),
    ["perform", "expand", "chair"],
    "same partOfSpeech and semanticCategory should be prioritized before broader fallbacks"
  );
}

{
  const multiPartOfSpeechWordsByVol = {
    vol1: [
      {
        id: "affix",
        word: "affix",
        meaning: "～を貼り付ける、添付する；接辞",
        sourceVol: "vol1",
        partOfSpeech: "verb,noun",
        semanticCategory: "action_activity"
      },
      {
        id: "perform",
        word: "perform",
        meaning: "実行する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      },
      {
        id: "object",
        word: "object",
        meaning: "物体",
        sourceVol: "vol1",
        partOfSpeech: "noun",
        semanticCategory: "object"
      },
      {
        id: "rapid",
        word: "rapid",
        meaning: "急速な",
        sourceVol: "vol1",
        partOfSpeech: "adjective",
        semanticCategory: "state_quality"
      }
    ]
  };

  const distractors = collectMultipleChoiceDistractors({
    current: multiPartOfSpeechWordsByVol.vol1[0],
    allWordsByVol: multiPartOfSpeechWordsByVol,
    volOrder: ["vol1"],
    translationMode: false
  });

  assert.deepStrictEqual(
    distractors.map((item) => item.word),
    ["perform", "object", "rapid"],
    "multi-valued partOfSpeech should match candidates sharing any listed part of speech"
  );
}

{
  const synonymousWordsByVol = {
    vol1: [
      {
        id: "boast",
        word: "boast",
        meaning: "自慢する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      },
      {
        id: "brag",
        word: "brag",
        meaning: "自慢する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      },
      {
        id: "perform",
        word: "perform",
        meaning: "実行する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      },
      {
        id: "expand",
        word: "expand",
        meaning: "拡大する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "change"
      },
      {
        id: "permit",
        word: "permit",
        meaning: "許可する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      }
    ]
  };

  const distractors = collectMultipleChoiceDistractors({
    current: synonymousWordsByVol.vol1[0],
    allWordsByVol: synonymousWordsByVol,
    volOrder: ["vol1"],
    translationMode: true
  });

  assert.deepStrictEqual(
    distractors.map((item) => item.word),
    ["perform", "permit", "expand"],
    "a different English word with the same Japanese meaning must not be a meaning-to-word distractor"
  );
}

{
  const overlappingGlossWordsByVol = {
    vol1: [
      {
        id: "detest",
        word: "detest",
        meaning: "～をひどく嫌う、憎む",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "emotion"
      },
      {
        id: "loathe",
        word: "loathe",
        meaning: "～をひどく嫌う",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "emotion"
      },
      {
        id: "envy",
        word: "envy",
        meaning: "～を羨む",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "emotion"
      },
      {
        id: "admire",
        word: "admire",
        meaning: "～を称賛する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "emotion"
      },
      {
        id: "perform",
        word: "perform",
        meaning: "実行する",
        sourceVol: "vol1",
        partOfSpeech: "verb",
        semanticCategory: "action_activity"
      }
    ]
  };

  const distractors = collectMultipleChoiceDistractors({
    current: overlappingGlossWordsByVol.vol1[0],
    allWordsByVol: overlappingGlossWordsByVol,
    volOrder: ["vol1"],
    translationMode: false
  });

  assert.deepStrictEqual(
    distractors.map((item) => item.word),
    ["envy", "admire", "perform"],
    "a candidate sharing any accepted Japanese gloss fragment must be excluded to avoid multiple valid answers"
  );
}

console.log("All multiple choice tests passed.");
