import { getLastBuiltMultipleChoiceQuestion } from './multipleChoice.js';

const LONG_PRESS_MS = 550;
const MOVE_TOLERANCE_PX = 12;
const CLICK_SUPPRESSION_MS = 1000;

let pressTimer = null;
let activePointerId = null;
let startX = 0;
let startY = 0;
let suppressClickButton = null;
let suppressClickResetTimer = null;

function getOptionButton(target) {
  return target instanceof Element
    ? target.closest('.multiple-choice-option')
    : null;
}

function isAnswered(optionsEl) {
  return Boolean(optionsEl.querySelector('.multiple-choice-option.is-correct'));
}

function getAnalysisItem(button) {
  const question = getLastBuiltMultipleChoiceQuestion();
  if (!question || !(button instanceof HTMLElement)) return null;

  const choiceIndex = Number(button.dataset.choiceIndex);
  if (!Number.isInteger(choiceIndex)) return null;

  return question.options?.[choiceIndex]?.analysisItem || null;
}

function clearPressTimer() {
  if (pressTimer !== null) {
    window.clearTimeout(pressTimer);
    pressTimer = null;
  }
}

function clearActivePress() {
  clearPressTimer();
  activePointerId = null;
}

function scheduleClickSuppressionReset() {
  if (suppressClickResetTimer !== null) {
    window.clearTimeout(suppressClickResetTimer);
  }

  suppressClickResetTimer = window.setTimeout(() => {
    suppressClickButton = null;
    suppressClickResetTimer = null;
  }, CLICK_SUPPRESSION_MS);
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function appendAnalysisRow(list, label, value) {
  const text = normalizeText(value);
  if (!text) return false;

  const term = document.createElement('dt');
  term.textContent = label;
  const detail = document.createElement('dd');
  detail.textContent = text;
  list.append(term, detail);
  return true;
}

function renderAnalysisItem(item) {
  const panel = document.getElementById('morphemeAnalysisPanel');
  if (!panel || !item) return;

  const content = document.createElement('div');
  content.className = 'morpheme-analysis-content';

  const heading = document.createElement('p');
  heading.className = 'morpheme-analysis-word';
  heading.textContent = normalizeText(item.word);
  content.appendChild(heading);

  const list = document.createElement('dl');
  list.className = 'morpheme-analysis-list';
  let hasDetails = false;
  [
    ['meaning：意味', item.meaning],
    ['morpheme：形態素', item.morpheme],
    ['morphemeMeaning：形態素の意味', item.morphemeMeaning],
    ['semanticDevelopment：意味の展開', item.semanticDevelopment],
    ['partOfSpeech：品詞', item.partOfSpeech],
    ['semanticCategory：意味カテゴリ', item.semanticCategory]
  ].forEach(([label, value]) => {
    hasDetails = appendAnalysisRow(list, label, value) || hasDetails;
  });

  if (!hasDetails) {
    appendAnalysisRow(list, '語源解析', 'この単語には語源・形態素データがまだ登録されていません。');
  }

  content.appendChild(list);
  panel.replaceChildren(content);
  panel.hidden = false;
}

function openAnalysisForChoice(button) {
  const item = getAnalysisItem(button);
  if (!item) return;

  suppressClickButton = button;
  scheduleClickSuppressionReset();

  const morphemeButton = document.getElementById('morphemeBtn');
  if (!(morphemeButton instanceof HTMLButtonElement) || morphemeButton.disabled) return;

  morphemeButton.click();
  renderAnalysisItem(item);
}

function handlePointerDown(event, optionsEl) {
  if (!event.isPrimary || !isAnswered(optionsEl)) return;

  const button = getOptionButton(event.target);
  if (!(button instanceof HTMLElement) || !getAnalysisItem(button)) return;

  button.style.userSelect = 'none';
  button.style.webkitUserSelect = 'none';
  button.style.webkitTouchCallout = 'none';

  clearActivePress();
  activePointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  pressTimer = window.setTimeout(() => {
    pressTimer = null;
    openAnalysisForChoice(button);
  }, LONG_PRESS_MS);
}

function handlePointerMove(event) {
  if (event.pointerId !== activePointerId || pressTimer === null) return;

  const movedX = Math.abs(event.clientX - startX);
  const movedY = Math.abs(event.clientY - startY);
  if (movedX > MOVE_TOLERANCE_PX || movedY > MOVE_TOLERANCE_PX) {
    clearActivePress();
  }
}

function handlePointerEnd(event) {
  if (event.pointerId !== activePointerId) return;
  clearActivePress();
}

function handleClickCapture(event) {
  const button = getOptionButton(event.target);
  if (!button || button !== suppressClickButton) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  suppressClickButton = null;
  if (suppressClickResetTimer !== null) {
    window.clearTimeout(suppressClickResetTimer);
    suppressClickResetTimer = null;
  }
}

function handleContextMenu(event, optionsEl) {
  const button = getOptionButton(event.target);
  if (!button || !isAnswered(optionsEl)) return;
  event.preventDefault();
}

function handleSelectStart(event, optionsEl) {
  const button = getOptionButton(event.target);
  if (!button || !isAnswered(optionsEl)) return;
  event.preventDefault();
}

export function initMultipleChoiceLongPressEtymology() {
  const optionsEl = document.getElementById('multipleChoiceOptions');
  if (!optionsEl || optionsEl.dataset.longPressEtymologyBound === 'true') return;

  optionsEl.dataset.longPressEtymologyBound = 'true';
  optionsEl.addEventListener('pointerdown', (event) => handlePointerDown(event, optionsEl));
  optionsEl.addEventListener('pointermove', handlePointerMove);
  optionsEl.addEventListener('pointerup', handlePointerEnd);
  optionsEl.addEventListener('pointercancel', handlePointerEnd);
  optionsEl.addEventListener('click', handleClickCapture, true);
  optionsEl.addEventListener('contextmenu', (event) => handleContextMenu(event, optionsEl));
  optionsEl.addEventListener('selectstart', (event) => handleSelectStart(event, optionsEl));
}
