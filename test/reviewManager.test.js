import assert from "assert";
import {
  getReviewStats,
  getReviewWeight,
  recordReviewAnswer,
  sortByReviewScore
} from "../reviewManager.js";

const item = { id: "alpha", word: "alpha" };
const scores = {};

recordReviewAnswer(scores, item, true, 1000);
assert.deepStrictEqual(
  getReviewStats(scores, item),
  { correct: 1, wrong: 0, streakCorrect: 1, streakWrong: 0, lastAnsweredAt: 1000 },
  "correct answers should update correct stats"
);
recordReviewAnswer(scores, item, false, 2000);
assert.deepStrictEqual(
  getReviewStats(scores, item),
  { correct: 1, wrong: 1, streakCorrect: 0, streakWrong: 1, lastAnsweredAt: 2000 },
  "wrong answers should update wrong stats and reset correct streak"
);
assert.strictEqual(getReviewWeight(scores, item), 4.5, "wrong stats should increase frequency weight");
recordReviewAnswer(scores, item, true, 3000);
recordReviewAnswer(scores, item, true, 4000);
assert.strictEqual(getReviewWeight(scores, item), 2.2, "correct streaks should reduce but not remove frequency weight");
scores.alpha.score = 5;
assert.strictEqual(getReviewWeight(scores, item), 2.2, "legacy manual scores should not affect frequency weight");
assert.strictEqual(getReviewWeight(scores, item, { starred: true }), 3.2, "starred words should get a small weight bonus");
const legacyScores = {
  hello: { correct: 0, wrong: 2, streakCorrect: 0, streakWrong: 2, lastAnsweredAt: 1000 }
};
const stableIdItem = { id: "w_stable1234", word: "hello" };
assert.strictEqual(getReviewStats(legacyScores, stableIdItem).wrong, 2, "legacy word-key review stats should remain readable");
recordReviewAnswer(legacyScores, stableIdItem, true, 5000);
assert.strictEqual(Boolean(legacyScores.w_stable1234), true, "new review answers should be saved under the stable id");
assert.strictEqual(Boolean(legacyScores.hello), false, "legacy review keys should be migrated after the next answer");

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
  "weighted random ordering should keep the same items without duplicates"
);

console.log("All review score tests passed.");
