import assert from "assert";
import { getNextSearchResultIndex } from "../searchController.js";

assert.strictEqual(
  getNextSearchResultIndex({ resultIndexes: [], currentIndex: 0, direction: 1 }),
  null,
  "empty search results should not return an index"
);

assert.strictEqual(
  getNextSearchResultIndex({ resultIndexes: [2, 5, 8], currentIndex: 2, direction: 1 }),
  5,
  "next search result should move forward from the active result"
);

assert.strictEqual(
  getNextSearchResultIndex({ resultIndexes: [2, 5, 8], currentIndex: 2, direction: -1 }),
  8,
  "previous search result should wrap backward"
);

assert.strictEqual(
  getNextSearchResultIndex({ resultIndexes: [2, 5, 8], currentIndex: 7, direction: 1 }),
  2,
  "forward search should use the first result when current word is outside the result set"
);

assert.strictEqual(
  getNextSearchResultIndex({ resultIndexes: [2, 5, 8], currentIndex: 7, direction: -1 }),
  8,
  "backward search should use the last result when current word is outside the result set"
);

console.log("All search controller tests passed.");
