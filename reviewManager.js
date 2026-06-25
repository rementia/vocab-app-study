import { makeWordKey } from "./wordIdentity.js";

const MIN_REVIEW_WEIGHT = 0.2;

function makeReviewKey(item) {
  return makeWordKey(item);
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

export function getReviewWeight(reviewScores, item, options = {}) {
  const stats = getReviewStats(reviewScores, item);
  const starredBonus = options.starred ? 1 : 0;
  const statsWeight = 1 + stats.wrong * 2 + stats.streakWrong * 1.5 - stats.streakCorrect * 0.4 + starredBonus;
  return Math.max(MIN_REVIEW_WEIGHT, statsWeight);
}

function pickWeightedEntry(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(MIN_REVIEW_WEIGHT, entry.score), 0);
  let random = Math.random() * totalWeight;

  for (const entry of entries) {
    random -= Math.max(MIN_REVIEW_WEIGHT, entry.score);
    if (random <= 0) return entry;
  }

  return entries[entries.length - 1] || null;
}

function createWeightedRandomOrder(entries) {
  const remaining = [...entries];
  const ordered = [];

  while (remaining.length) {
    const picked = pickWeightedEntry(remaining);
    if (!picked) break;
    ordered.push(picked);
    remaining.splice(remaining.indexOf(picked), 1);
  }

  return ordered;
}

export function sortByReviewScore(words, getScore, options = {}) {
  const randomizeTies = Boolean(options.randomizeTies);

  const entries = [...words].map((item, originalIndex) => (
    createReviewSortEntry(item, originalIndex, getScore, randomizeTies)
  ));

  return (randomizeTies ? createWeightedRandomOrder(entries) : entries.sort(compareReviewSortEntries))
    .map(({ item }) => item);
}
