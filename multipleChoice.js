import { shareDistractorExclusionGroup } from "./distractorExclusions.js";

function shuffleArray(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

export function getMultipleChoiceDirection({ translationMode }) {
  return translationMode ? "meaning-to-word" : "word-to-meaning";
}

export function getMultipleChoicePrompt(item, { translationMode }) {
  return translationMode ? item.meaning : item.word;
}

export function getMultipleChoiceAnswerText(item, { translationMode }) {
  return translationMode ? item.word : item.meaning;
}

export function getMultipleChoiceSecondaryText(item, { translationMode }) {
  return translationMode ? item.meaning : item.word;
}

function sameWord(a, b) {
  return Boolean(a && b && (a.id === b.id || a.word === b.word));
}

function getAllLoadedWords(allWordsByVol, volOrder) {
  return volOrder.flatMap((volName) => allWordsByVol[volName] || []);
}

function hasChoiceText(item, options) {
  return Boolean(getMultipleChoiceAnswerText(item, options));
}

function normalizeMetadata(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeMetadataSet(value) {
  return normalizeMetadata(value)
    .split(/[,;|/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasMetadataOverlap(leftValue, rightValue) {
  const left = normalizeMetadataSet(leftValue);
  const right = new Set(normalizeMetadataSet(rightValue));
  return left.some((item) => right.has(item));
}

function normalizeMeaningFragment(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[~～〜]/g, "")
    .replace(/\s+/g, "")
    .replace(/\((?:英|米|主に英|主に米|口語|俗|文語)\)$/g, "")
    .replace(/^(?:を|に|が|は)/, "")
    .trim();
}

function getMeaningFragments(value) {
  return String(value ?? "")
    .split(/[、,;；]/)
    .map(normalizeMeaningFragment)
    .filter(Boolean);
}

function hasMeaningOverlap(leftItem, rightItem) {
  const left = getMeaningFragments(leftItem?.meaning);
  const right = new Set(getMeaningFragments(rightItem?.meaning));
  return left.some((fragment) => right.has(fragment));
}

function getDistractorPriority(current, item) {
  const currentPartOfSpeech = normalizeMetadata(current?.partOfSpeech);
  const candidatePartOfSpeech = normalizeMetadata(item?.partOfSpeech);
  const currentSemanticCategory = normalizeMetadata(current?.semanticCategory);
  const candidateSemanticCategory = normalizeMetadata(item?.semanticCategory);
  const hasSamePartOfSpeech = Boolean(
    currentPartOfSpeech &&
    candidatePartOfSpeech &&
    hasMetadataOverlap(currentPartOfSpeech, candidatePartOfSpeech)
  );
  const hasSameSemanticCategory = Boolean(
    currentSemanticCategory &&
    candidateSemanticCategory &&
    currentSemanticCategory === candidateSemanticCategory
  );

  if (hasSamePartOfSpeech && hasSameSemanticCategory) return 0;
  if (hasSamePartOfSpeech) return 1;
  if (hasSameSemanticCategory) return 2;
  return 3;
}

function uniqueByChoiceText(candidates, correctText, options) {
  return candidates.reduce((unique, item) => {
    const choiceText = getMultipleChoiceAnswerText(item, options);
    if (
      !choiceText ||
      choiceText === correctText ||
      unique.some((candidate) => getMultipleChoiceAnswerText(candidate, options) === choiceText)
    ) {
      return unique;
    }
    unique.push(item);
    return unique;
  }, []);
}

function sortCandidatesByMetadataPriority(current, candidates) {
  return candidates
    .map((item, index) => ({
      item,
      index,
      priority: getDistractorPriority(current, item)
    }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(({ item }) => item);
}

function shuffleWithinMetadataPriority(current, candidates, shuffle) {
  return [0, 1, 2, 3].flatMap((priority) => {
    const bucket = candidates.filter((item) => getDistractorPriority(current, item) === priority);
    return shuffle(bucket);
  });
}

export function collectMultipleChoiceDistractors({
  current,
  allWordsByVol,
  volOrder,
  translationMode
}) {
  const options = { translationMode };
  const correctText = getMultipleChoiceAnswerText(current, options);
  const isEligibleDistractor = (item) => (
    !sameWord(item, current) &&
    hasChoiceText(item, options) &&
    !hasMeaningOverlap(current, item) &&
    !shareDistractorExclusionGroup(current, item)
  );
  const sameVolCandidates = (allWordsByVol[current.sourceVol] || [])
    .filter(isEligibleDistractor);
  const allCandidates = getAllLoadedWords(allWordsByVol, volOrder)
    .filter(isEligibleDistractor);

  return sortCandidatesByMetadataPriority(
    current,
    uniqueByChoiceText([...sameVolCandidates, ...allCandidates], correctText, options)
  );
}

export function buildMultipleChoiceQuestion({
  current,
  allWordsByVol,
  volOrder,
  translationMode,
  shuffle = shuffleArray
}) {
  const options = { translationMode };
  const correctText = getMultipleChoiceAnswerText(current, options);
  if (!current || !correctText) return null;

  const distractors = shuffleWithinMetadataPriority(
    current,
    collectMultipleChoiceDistractors({
      current,
      allWordsByVol,
      volOrder,
      translationMode
    }),
    shuffle
  ).slice(0, 3);
  const choices = shuffle([
    { text: correctText, secondaryText: getMultipleChoiceSecondaryText(current, options), isCorrect: true },
    ...distractors.map((item) => ({
      text: getMultipleChoiceAnswerText(item, options),
      secondaryText: getMultipleChoiceSecondaryText(item, options),
      isCorrect: false
    }))
  ]);

  return {
    wordId: current.id,
    direction: getMultipleChoiceDirection(options),
    prompt: getMultipleChoicePrompt(current, options),
    correctText,
    options: choices
  };
}
