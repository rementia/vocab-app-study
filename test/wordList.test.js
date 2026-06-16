import assert from "node:assert/strict";
import { buildMarkedWordEntries, clampIndex } from "../wordList.js";

{
  const words = [{ word: "first" }, { word: "second" }];

  assert.equal(clampIndex(0, words), 0);
  assert.equal(clampIndex(1, words), 1);
  assert.equal(clampIndex(99, words), 1);
  assert.equal(clampIndex(-1, words), 0);
  assert.equal(clampIndex(0, []), 0);
  assert.equal(clampIndex(-1, []), 0);
}

{
  const allWordsByVol = {
    vol1: [{ word: "apple" }, { word: "banana" }],
    vol2: [{ word: "cherry" }]
  };

  const records = {
    apple: true,
    cherry: true
  };

  const entries = buildMarkedWordEntries(
    allWordsByVol,
    ["vol1", "vol2", "vol3"],
    records,
    (markedRecords, item) => Boolean(markedRecords[item.word])
  );

  assert.deepEqual(entries, [{ word: "apple" }, { word: "cherry" }]);
}

console.log("All word list tests passed.");
