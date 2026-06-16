let historyBackStack = [];
let historyForwardStack = [];

let getIndexFn = null;
let setIndexFn = null;
let renderFn = null;
let scheduleSpeechSyncFn = null;
let getWordsLengthFn = null;

export function initNavigation({ getIndex, setIndex, renderCurrentWord, scheduleSpeechSync, getWordsLength }) {
  getIndexFn = getIndex;
  setIndexFn = setIndex;
  renderFn = renderCurrentWord;
  scheduleSpeechSyncFn = scheduleSpeechSync;
  getWordsLengthFn = getWordsLength;
}

const HISTORY_MAX = 30;

function pushStack(stack, value) {
  stack.push(value);
  if (stack.length > HISTORY_MAX) {
    stack.splice(0, stack.length - HISTORY_MAX);
  }
}

function isValidIndex(index, max) {
  return typeof index === 'number' && index >= 0 && index < max;
}

function popValidHistoryIndex(stack, max) {
  while (stack.length) {
    const nextIndex = stack.pop();
    if (!isValidIndex(nextIndex, max)) continue;
    return nextIndex;
  }

  return null;
}

export function clearNavigationHistory() {
  historyBackStack = [];
  historyForwardStack = [];
}

export function moveToIndex(nextIndex, { pushHistory = false } = {}) {
  if (!getWordsLengthFn) return;

  const wordsLength = getWordsLengthFn();
  if (wordsLength === 0) return;
  if (!isValidIndex(nextIndex, wordsLength)) return;
  if (nextIndex === getIndexFn()) return;

  if (pushHistory) {
    pushStack(historyBackStack, getIndexFn());
    historyForwardStack = [];
  }

  setIndexFn(nextIndex);
  if (typeof renderFn === 'function') renderFn();
  if (typeof scheduleSpeechSyncFn === 'function') scheduleSpeechSyncFn();
}

export function getRandomPrevIndexFromHistory() {
  if (!getIndexFn || !getWordsLengthFn) return null;
  const prev = popValidHistoryIndex(historyBackStack, getWordsLengthFn());
  if (prev === null) return null;

  pushStack(historyForwardStack, getIndexFn());
  return prev;
}

export function getRandomNextIndexFromHistory() {
  if (!getIndexFn || !getWordsLengthFn) return null;
  const next = popValidHistoryIndex(historyForwardStack, getWordsLengthFn());
  if (next === null) return null;

  pushStack(historyBackStack, getIndexFn());
  return next;
}

export function getHistoryBackStack() {
  return historyBackStack.slice();
}

export function getHistoryForwardStack() {
  return historyForwardStack.slice();
}
