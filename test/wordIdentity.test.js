import assert from "assert";
import {
  makeWordKey,
  migrateLegacyWordRecords,
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
assert.strictEqual(normalizeStoredWordKey("vol1::Ambulance"), "ambulance");
assert.strictEqual(normalizeStoredWordKey("hello"), "hello");
const legacyRecords = {
  "vol2-715-sweetheart": { addedAt: 1 },
  "vol1::ambulance": { addedAt: 2 },
  unrelated: { addedAt: 3 }
};
assert.strictEqual(migrateLegacyWordRecords(legacyRecords, {
  vol1: [{ id: "w_ambulance001", word: "ambulance", legacyWordKey: "ambulance", sourceVol: "vol1" }],
  vol2: [{ id: "w_sweetheart001", word: "sweetheart", legacyWordKey: "sweetheart", sourceVol: "vol2" }]
}).changed, true);
assert.deepStrictEqual(legacyRecords, {
  w_sweetheart001: { addedAt: 1 },
  w_ambulance001: { addedAt: 2 },
  unrelated: { addedAt: 3 }
});

const duplicateLegacyRecords = {
  "vol2-715-sweetheart": { addedAt: 1 },
  w_sweetheart001: { addedAt: 9 }
};
migrateLegacyWordRecords(duplicateLegacyRecords, {
  vol2: [{ id: "w_sweetheart001", word: "sweetheart", legacyWordKey: "sweetheart", sourceVol: "vol2" }]
});
assert.deepStrictEqual(duplicateLegacyRecords, {
  w_sweetheart001: { addedAt: 9 }
});

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