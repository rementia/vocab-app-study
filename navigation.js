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

export function clearNavigationHistory() {
  historyBackStack = [];
  historyForwardStack = [];
}

export function moveToIndex(nextIndex, { pushHistory = false } = {}) {
  if (!getWordsLengthFn || getWordsLengthFn() === 0) return;
  if (nextIndex < 0 || nextIndex >= getWordsLengthFn()) return;
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
  const max = getWordsLengthFn();
  while (historyBackStack.length) {
    const prev = historyBackStack.pop();
    if (typeof prev !== 'number') continue;
    if (prev < 0 || prev >= max) continue;
    pushStack(historyForwardStack, getIndexFn());
    return prev;
  }
  return null;
}

export function getRandomNextIndexFromHistory() {
  if (!getIndexFn || !getWordsLengthFn) return null;
  const max = getWordsLengthFn();
  while (historyForwardStack.length) {
    const next = historyForwardStack.pop();
    if (typeof next !== 'number') continue;
    if (next < 0 || next >= max) continue;
    pushStack(historyBackStack, getIndexFn());
    return next;
  }
  return null;
}

export function getHistoryBackStack() {
  return historyBackStack.slice();
}

export function getHistoryForwardStack() {
  return historyForwardStack.slice();
}
