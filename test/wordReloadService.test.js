import assert from "assert";
import {
  formatReloadSuccessMessage,
  getPreserveWordId,
  getReloadedIndex
} from "../wordReloadService.js";

const words = [
  { id: "alpha", word: "alpha" },
  { id: "bravo", word: "bravo" },
  { id: "charlie", word: "charlie" }
];

assert.strictEqual(getPreserveWordId(words, 1), "bravo");
assert.strictEqual(getPreserveWordId(words, 99), null);

assert.strictEqual(
  getReloadedIndex({ words, previousIndex: 0, preserveWordId: "charlie" }),
  2,
  "reload should preserve the current word when its id still exists"
);

assert.strictEqual(
  getReloadedIndex({ words, previousIndex: 99, preserveWordId: "missing" }),
  2,
  "reload should clamp an out-of-range index when the current word no longer exists"
);

assert.strictEqual(
  getReloadedIndex({ words: [], previousIndex: 5, preserveWordId: "missing" }),
  0,
  "reload should keep an empty list index at 0"
);

assert.strictEqual(
  formatReloadSuccessMessage({
    volumes: ["vol1"],
    wordsByVol: {
      vol1: [{ id: "a" }, { id: "b" }]
    }
  }),
  "vol1 を再読み込みしました（2語）",
  "single volume reload summary should include volume name and count"
);

assert.strictEqual(
  formatReloadSuccessMessage({
    volumes: ["vol1", "vol2"],
    wordsByVol: {
      vol1: [{ id: "a" }],
      vol2: [{ id: "b" }, { id: "c" }]
    }
  }),
  "全volumeを再読み込みしました（合計3語）",
  "multi-volume reload summary should include total count"
);

assert.strictEqual(
  formatReloadSuccessMessage({
    volumes: ["vol1"],
    wordsByVol: {
      vol1: [{ id: "a" }]
    },
    metaByVol: {
      vol1: { syncLabel: "2026-06-20T00:00:00.000Z" }
    }
  }),
  "vol1 を再読み込みしました（1語 / 同期: 2026-06-20T00:00:00.000Z）",
  "reload summary should include optional sync metadata"
);

console.log("All word reload service tests passed.");
