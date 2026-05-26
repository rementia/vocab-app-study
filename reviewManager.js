export function makeReviewKey(item) {
  return item.id;
}

export function getReviewScore(reviewScores, item) {
  return Number(reviewScores[makeReviewKey(item)]?.score) || 0;
}

export function updateReviewScore(reviewScores, item, delta) {
  const key = makeReviewKey(item);
  const currentScore = getReviewScore(reviewScores, item);
  const nextScore = Math.max(-5, Math.min(5, currentScore + delta));

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
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      score: getScore(item),
      tieRank: randomizeTies ? Math.random() : 0
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.tieRank !== b.tieRank) return a.tieRank - b.tieRank;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ item }) => item);
}