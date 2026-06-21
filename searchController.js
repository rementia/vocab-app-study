export function getNextSearchResultIndex({ resultIndexes, currentIndex, direction }) {
  if (!Array.isArray(resultIndexes) || resultIndexes.length === 0) return null;

  const activeResultIndex = resultIndexes.findIndex((itemIndex) => itemIndex === currentIndex);
  const fallbackIndex = direction > 0 ? 0 : resultIndexes.length - 1;
  const nextResultIndex = activeResultIndex >= 0
    ? (activeResultIndex + direction + resultIndexes.length) % resultIndexes.length
    : fallbackIndex;

  return resultIndexes[nextResultIndex];
}
