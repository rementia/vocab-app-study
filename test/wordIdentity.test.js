import assert from "assert";
import {
  makeWordKey,
  normalizeStoredWordKey,
  normalizeWordKey,
  normalizeWordRecordMap
} from "../wordIdentity.js";

assert.strictEqual(normalizeWordKey(" Hello "), "hello");
assert.strictEqual(makeWordKey({ id: "w_abcd1234", word: "Hello" }), "w_abcd1234");
assert.strictEqual(makeWordKey({ word: "Hello" }), "hello");
assert.strictEqual(makeWordKey({ id: "vol1-2-Hello" }), "vol1-2-hello");

assert.strictEqual(normalizeStoredWordKey("vol1-2-Hello"), "hello");
assert.strictEqual(normalizeStoredWordKey(" vol2-10-Study "), "study");
assert.strictEqual(normalizeStoredWordKey("hello"), "hello");

assert.deepStrictEqual(
  normalizeWordRecordMap({
    "vol1-2-Hello": { addedAt: 1 },
    hello: { updatedAt: 2 },
    "vol3-40-World": { score: 3 }
  }),
  {
    hello: { addedAt: 1, updatedAt: 2 },
    world: { score: 3 }
  }
);

assert.deepStrictEqual(normalizeWordRecordMap(null), {});

console.log("All word identity tests passed.");