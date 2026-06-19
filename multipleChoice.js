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

export function collectMultipleChoiceDistractors({
  current,
  allWordsByVol,
  volOrder,
  translationMode
}) {
  const options = { translationMode };
  const correctText = getMultipleChoiceAnswerText(current, options);
  const sameVolCandidates = (allWordsByVol[current.sourceVol] || [])
    .filter((item) => !sameWord(item, current) && hasChoiceText(item, options));
  const allCandidates = getAllLoadedWords(allWordsByVol, volOrder)
    .filter((item) => !sameWord(item, current) && hasChoiceText(item, options));

  return [...sameVolCandidates, ...allCandidates].reduce((unique, item) => {
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

  const distractors = shuffle(collectMultipleChoiceDistractors({
    current,
    allWordsByVol,
    volOrder,
    translationMode
  })).slice(0, 3);
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
