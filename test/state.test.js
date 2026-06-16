import assert from "assert";
import {
  createInitialIndexByVol,
  createInitialWordsByVol,
  volOrder
} from "../state.js";

const initialWordsByVol = createInitialWordsByVol();
assert.deepStrictEqual(Object.keys(initialWordsByVol), volOrder, "initial word buckets should follow volOrder");
assert.deepStrictEqual(initialWordsByVol.vol1, [], "each volume should start with an empty word list");

const initialIndexByVol = createInitialIndexByVol();
assert.deepStrictEqual(
  volOrder.map((vol) => initialIndexByVol[vol]),
  volOrder.map(() => 0),
  "each volume should start at index 0"
);
assert.strictEqual(initialIndexByVol.favorites, 0);
assert.strictEqual(initialIndexByVol.difficults, 0);

console.log("All state tests passed.");
