import { makeWordKey } from "./wordIdentity.js";

const MIN_REVIEW_SCORE = -5;
const MAX_REVIEW_SCORE = 5;

function makeReviewKey(item) {
  return makeWordKey(item);
}

function clampReviewScore(score) {
  return Math.max(MIN_REVIEW_SCORE, Math.min(MAX_REVIEW_SCORE, score));
}

function createReviewSortEntry(item, originalIndex, getScore, randomizeTies) {
  return {
    item,
    originalIndex,
    score: getScore(item),
    tieRank: randomizeTies ? Math.random() : 0
  };
}

function compareReviewSortEntries(a, b) {
  if (b.score !== a.score) return b.score - a.score;
  if (a.tieRank !== b.tieRank) return a.tieRank - b.tieRank;
  return a.originalIndex - b.originalIndex;
}

export function getReviewScore(reviewScores, item) {
  return Number(reviewScores[makeReviewKey(item)]?.score) || 0;
}

export function updateReviewScore(reviewScores, item, delta) {
  const key = makeReviewKey(item);
  const currentScore = getReviewScore(reviewScores, item);
  const nextScore = clampReviewScore(currentScore + delta);

  if (nextScore === 0) {
    delete reviewScores[key];
  } else {
    reviewScores[key] = {
      score: nextScore,
      updatedAt: Date.now()
    };
  }

  return nextScore;
}

export function resetReviewScore(reviewScores, item) {
  delete reviewScores[makeReviewKey(item)];
  return 0;
}

export function sortByReviewScore(words, getScore, options = {}) {
  const randomizeTies = Boolean(options.randomizeTies);

  return [...words]
    .map((item, originalIndex) => createReviewSortEntry(item, originalIndex, getScore, randomizeTies))
    .sort(compareReviewSortEntries)
    .map(({ item }) => item);
}
