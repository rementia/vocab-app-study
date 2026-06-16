function getOrderMode({ randomMode, frequencyMode }) {
  if (randomMode && frequencyMode) return "frequency-random";
  if (frequencyMode) return "frequency";
  if (randomMode) return "random";
  return null;
}

function getOrderScope({ currentMode, currentVol }) {
  if (currentMode === "favorites") return "favorites:all";
  if (currentMode === "difficults") return "difficults:all";
  return `vol:${currentVol}`;
}

function makeWordOrderCacheKey(orderMode, scope) {
  return `${orderMode}:${scope}`;
}

function shuffleWords(words) {
  const copied = [...words];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function getWordIdSet(words) {
  return new Set(words.map((item) => item.id));
}

function hasSameWordIds(cachedWords, baseWords) {
  const baseIds = getWordIdSet(baseWords);
  return cachedWords.every((item) => baseIds.has(item.id));
}

function isCachedOrderValid(cachedWords, baseWords) {
  return (
    Array.isArray(cachedWords) &&
    cachedWords.length === baseWords.length &&
    hasSameWordIds(cachedWords, baseWords)
  );
}

export function buildWordOrder({
  baseWords,
  currentMode,
  currentVol,
  randomMode,
  frequencyMode,
  orderCache,
  createFrequencyOrder
}) {
  const orderMode = getOrderMode({ randomMode, frequencyMode });
  if (!orderMode) return baseWords;

  const cacheKey = makeWordOrderCacheKey(orderMode, getOrderScope({ currentMode, currentVol }));

  if (!isCachedOrderValid(orderCache[cacheKey], baseWords)) {
    orderCache[cacheKey] = frequencyMode
      ? createFrequencyOrder(baseWords, { randomizeTies: randomMode })
      : shuffleWords(baseWords);
  }

  return orderCache[cacheKey];
}
