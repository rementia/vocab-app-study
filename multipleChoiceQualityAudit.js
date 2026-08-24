import { collectMultipleChoiceDistractors, getDistractorPriority } from "./multipleChoice.js";

function getMeaningSenseCount(value) {
  const text = String(value ?? "").trim();
  return text ? text.split(/[;；]/).length : 0;
}

function hasMeaningPlaceholder(value) {
  return /[~～〜]/.test(String(value ?? ""));
}

function getMeaningLengthBand(value) {
  const length = String(value ?? "").replace(/\s+/g, "").length;
  if (length <= 5) return 0;
  if (length <= 8) return 1;
  if (length <= 12) return 2;
  if (length <= 18) return 3;
  return 4;
}

function getMeaningShape(item) {
  return {
    senseCount: getMeaningSenseCount(item?.meaning),
    hasPlaceholder: hasMeaningPlaceholder(item?.meaning),
    lengthBand: getMeaningLengthBand(item?.meaning)
  };
}

function hasSameMeaningShape(left, right) {
  const a = getMeaningShape(left);
  const b = getMeaningShape(right);
  return (
    a.senseCount === b.senseCount &&
    a.hasPlaceholder === b.hasPlaceholder &&
    a.lengthBand === b.lengthBand
  );
}

function groupByVolume(words) {
  return words.reduce((grouped, item) => {
    const vol = String(item?.sourceVol ?? "");
    if (!grouped[vol]) grouped[vol] = [];
    grouped[vol].push(item);
    return grouped;
  }, {});
}

function countDuplicateMeanings(words) {
  const grouped = new Map();
  words.forEach((item) => {
    const meaning = String(item?.meaning ?? "").trim();
    if (!meaning) return;
    if (!grouped.has(meaning)) grouped.set(meaning, []);
    grouped.get(meaning).push(item);
  });
  return [...grouped.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([meaning, items]) => ({
      meaning,
      words: items.map((item) => item.word),
      ids: items.map((item) => item.id)
    }));
}

export function auditMultipleChoiceQuality(words) {
  const items = Array.isArray(words) ? words.filter((item) => item?.word) : [];
  const allWordsByVol = groupByVolume(items);
  const volOrder = Object.keys(allWordsByVol).sort();
  const formatReady = [];
  const formatFallback = [];
  const sameVolTopTierInsufficient = [];

  items.forEach((current) => {
    const candidates = collectMultipleChoiceDistractors({
      current,
      allWordsByVol,
      volOrder,
      translationMode: false
    });
    if (candidates.length === 0) {
      sameVolTopTierInsufficient.push({ id: current.id, word: current.word, candidateCount: 0 });
      return;
    }

    const topPriority = Math.min(...candidates.map((item) => getDistractorPriority(current, item)));
    const sameVolTopTier = candidates.filter((item) => (
      item.sourceVol === current.sourceVol &&
      getDistractorPriority(current, item) === topPriority
    ));
    const exactFormatMatches = sameVolTopTier.filter((item) => hasSameMeaningShape(current, item));

    if (exactFormatMatches.length >= 3) {
      formatReady.push({ id: current.id, word: current.word, exactFormatMatches: exactFormatMatches.length });
    } else {
      formatFallback.push({
        id: current.id,
        word: current.word,
        sameVolTopTier: sameVolTopTier.length,
        exactFormatMatches: exactFormatMatches.length
      });
    }

    if (sameVolTopTier.length < 3) {
      sameVolTopTierInsufficient.push({
        id: current.id,
        word: current.word,
        candidateCount: sameVolTopTier.length
      });
    }
  });

  const duplicateMeanings = countDuplicateMeanings(items);
  return {
    totalWords: items.length,
    formatReadyCount: formatReady.length,
    formatFallbackCount: formatFallback.length,
    sameVolTopTierInsufficientCount: sameVolTopTierInsufficient.length,
    duplicateMeaningGroupCount: duplicateMeanings.length,
    formatReady,
    formatFallback,
    sameVolTopTierInsufficient,
    duplicateMeanings
  };
}
