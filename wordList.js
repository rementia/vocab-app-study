export function clampIndex(value, words) {
  return Math.max(0, Math.min(value, Math.max(words.length - 1, 0)));
}

export function buildMarkedWordEntries(allWordsByVol, volOrder, records, isMarked) {
  const entries = [];

  volOrder.forEach((vol) => {
    (allWordsByVol[vol] || []).forEach((item) => {
      if (isMarked(records, item)) {
        entries.push(item);
      }
    });
  });

  return entries;
}
