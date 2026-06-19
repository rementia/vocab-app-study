import assert from "assert";
import {
  getReviewScore,
  getReviewStats,
  getReviewWeight,
  recordReviewAnswer,
  resetReviewScore,
  sortByReviewScore,
  updateReviewScore
} from "../reviewManager.js";

const item = { id: "vol1-1-alpha", word: "alpha" };
const scores = {};

assert.strictEqual(getReviewScore(scores, item), 0);
assert.strictEqual(updateReviewScore(scores, item, 1), 1);
assert.strictEqual(getReviewScore(scores, item), 1);
assert.strictEqual(updateReviewScore(scores, item, -1), 0);
assert.strictEqual(getReviewScore(scores, item), 0);
assert.strictEqual(Boolean(scores.alpha), false, "zero scores should be removed from storage data");
assert.strictEqual(updateReviewScore(scores, item, -10), -5);
assert.strictEqual(updateReviewScore(scores, item, 20), 5);
assert.strictEqual(resetReviewScore(scores, item), 0);
assert.strictEqual(getReviewScore(scores, item), 0);

const statsScores = {};
recordReviewAnswer(statsScores, item, true, 1000);
recordReviewAnswer(statsScores, item, false, 2000);
assert.deepStrictEqual(getReviewStats(statsScores, item), {
  correct: 1,
  wrong: 1,
  streakCorrect: 0,
  streakWrong: 1,
  lastAnsweredAt: 2000
});
assert.strictEqual(getReviewWeight(statsScores, item), 4.5);
updateReviewScore(statsScores, item, 2);
assert.strictEqual(getReviewWeight(statsScores, item), 6.5);
resetReviewScore(statsScores, item);
assert.deepStrictEqual(getReviewStats(statsScores, item), {
  correct: 1,
  wrong: 1,
  streakCorrect: 0,
  streakWrong: 1,
  lastAnsweredAt: 2000
}, "resetting manual score should preserve answer stats");

const scoredItems = [
  { id: "a" },
  { id: "b" },
  { id: "c" },
  { id: "d" }
];
const sorted = sortByReviewScore(scoredItems, (candidate) => ({ a: 1, b: 3, c: 1, d: -2 })[candidate.id]);
assert.strictEqual(sorted[0].id, "b", "highest score should come first");
assert.strictEqual(sorted[3].id, "d", "lowest score should come last");
assert.deepStrictEqual(
  sorted.slice(1, 3).map((candidate) => candidate.id),
  ["a", "c"],
  "same score items should keep original order by default"
);

const stableTieSorted = sortByReviewScore(scoredItems, () => 1);
assert.deepStrictEqual(
  stableTieSorted.map((candidate) => candidate.id),
  ["a", "b", "c", "d"],
  "same score items should keep original order unless tie randomization is requested"
);

const randomizedTieSorted = sortByReviewScore(scoredItems, () => 1, { randomizeTies: true });
assert.deepStrictEqual(
  randomizedTieSorted.map((candidate) => candidate.id).sort(),
  ["a", "b", "c", "d"],
  "tie randomization should keep the same items"
);

console.log("All review score tests passed.");
