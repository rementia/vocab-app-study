import assert from "assert";
import { getPreserveWordId, getReloadedIndex } from "../wordReloadService.js";

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

console.log("All word reload service tests passed.");
