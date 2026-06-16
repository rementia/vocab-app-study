import assert from "node:assert/strict";
import { buildWordOrder } from "../wordOrder.js";

const words = [
  { id: "alpha", word: "alpha" },
  { id: "beta", word: "beta" }
];

{
  const orderCache = {};
  const ordered = buildWordOrder({
    baseWords: words,
    currentMode: "vol",
    currentVol: "vol1",
    randomMode: false,
    frequencyMode: false,
    orderCache,
    createFrequencyOrder: () => {
      throw new Error("frequency order should not be created in normal mode");
    }
  });

  assert.equal(ordered, words);
  assert.deepEqual(orderCache, {});
}

{
  const orderCache = {};
  const ordered = buildWordOrder({
    baseWords: words,
    currentMode: "favorites",
    currentVol: "vol1",
    randomMode: false,
    frequencyMode: true,
    orderCache,
    createFrequencyOrder: (baseWords, options) => {
      assert.equal(options.randomizeTies, false);
      return [...baseWords].reverse();
    }
  });

  assert.deepEqual(ordered.map((item) => item.id), ["beta", "alpha"]);
  assert.equal(orderCache["frequency:favorites:all"], ordered);
}

{
  const cached = [{ id: "alpha", word: "alpha" }];
  const orderCache = {
    "random:vol:vol1": cached
  };

  const ordered = buildWordOrder({
    baseWords: words,
    currentMode: "vol",
    currentVol: "vol1",
    randomMode: true,
    frequencyMode: false,
    orderCache,
    createFrequencyOrder: () => {
      throw new Error("frequency order should not be used for random-only mode");
    }
  });

  assert.equal(ordered.length, 2);
  assert.notEqual(ordered, cached);
  assert.equal(orderCache["random:vol:vol1"], ordered);
}

{
  const cached = [words[1], words[0]];
  const orderCache = {
    "random:vol:vol1": cached
  };

  const ordered = buildWordOrder({
    baseWords: words,
    currentMode: "vol",
    currentVol: "vol1",
    randomMode: true,
    frequencyMode: false,
    orderCache,
    createFrequencyOrder: () => {
      throw new Error("frequency order should not be used for random-only mode");
    }
  });

  assert.equal(ordered, cached);
}

console.log("All word order tests passed.");
