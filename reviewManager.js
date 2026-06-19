import { makeWordKey } from "./wordIdentity.js";

const MIN_REVIEW_SCORE = -5;
const MAX_REVIEW_SCORE = 5;
const MIN_REVIEW_WEIGHT = 0.5;

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

export function getReviewStats(reviewScores, item) {
  const stats = reviewScores[makeReviewKey(item)] || {};
  return {
    correct: Number(stats.correct) || 0,
    wrong: Number(stats.wrong) || 0,
    streakCorrect: Number(stats.streakCorrect) || 0,
    streakWrong: Number(stats.streakWrong) || 0,
    lastAnsweredAt: Number(stats.lastAnsweredAt) || 0
  };
}

export function updateReviewScore(reviewScores, item, delta) {
  const key = makeReviewKey(item);
  const currentScore = getReviewScore(reviewScores, item);
  const nextScore = clampReviewScore(currentScore + delta);

  if (nextScore === 0) {
    const current = reviewScores[key];
    if (!current) return nextScore;

    const { score, updatedAt, ...stats } = current;
    if (Object.keys(stats).length) {
      reviewScores[key] = stats;
    } else {
      delete reviewScores[key];
    }
  } else {
    reviewScores[key] = {
      ...(reviewScores[key] || {}),
      score: nextScore,
      updatedAt: Date.now()
    };
  }

  return nextScore;
}

export function resetReviewScore(reviewScores, item) {
  const key = makeReviewKey(item);
  const current = reviewScores[key];
  if (!current) return 0;

  const { score, updatedAt, ...stats } = current;
  if (Object.keys(stats).length) {
    reviewScores[key] = stats;
  } else {
    delete reviewScores[key];
  }
  return 0;
}

export function recordReviewAnswer(reviewScores, item, isCorrect, answeredAt = Date.now()) {
  const key = makeReviewKey(item);
  const current = reviewScores[key] || {};
  const next = {
    ...current,
    correct: Number(current.correct) || 0,
    wrong: Number(current.wrong) || 0,
    streakCorrect: Number(current.streakCorrect) || 0,
    streakWrong: Number(current.streakWrong) || 0,
    lastAnsweredAt: answeredAt
  };

  if (isCorrect) {
    next.correct += 1;
    next.streakCorrect += 1;
    next.streakWrong = 0;
  } else {
    next.wrong += 1;
    next.streakWrong += 1;
    next.streakCorrect = 0;
  }

  reviewScores[key] = next;
  return getReviewStats(reviewScores, item);
}

export function getReviewWeight(reviewScores, item) {
  const score = getReviewScore(reviewScores, item);
  const stats = getReviewStats(reviewScores, item);
  const statsWeight = 1 + stats.wrong * 2 + stats.streakWrong * 1.5 - stats.streakCorrect * 0.5;
  return Math.max(MIN_REVIEW_WEIGHT, statsWeight + score);
}

export function sortByReviewScore(words, getScore, options = {}) {
  const randomizeTies = Boolean(options.randomizeTies);

  return [...words]
    .map((item, originalIndex) => createReviewSortEntry(item, originalIndex, getScore, randomizeTies))
    .sort(compareReviewSortEntries)
    .map(({ item }) => item);
}
