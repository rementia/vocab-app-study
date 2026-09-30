import { getLastBuiltMultipleChoiceQuestion } from './multipleChoice.js?v=20260922-1';

const LONG_PRESS_MS = 500;
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

function openAnalysisForChoice(button) {
  const item = getAnalysisItem(button);
  if (!item) return;

  suppressClickButton = button;
  scheduleClickSuppressionReset();

  button.dispatchEvent(new CustomEvent('multiple-choice-etymology-open', {
    bubbles: true,
    detail: { item }
  }));
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

  // 長押し中に指が選択肢の枠外へ出ても終了イベントを確実に受け取る。
  if (typeof button.setPointerCapture === 'function') {
    try {
      button.setPointerCapture(event.pointerId);
    } catch {}
  }

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

  const button = getOptionButton(event.target);
  if (
    button instanceof HTMLElement &&
    typeof button.hasPointerCapture === 'function' &&
    button.hasPointerCapture(event.pointerId) &&
    typeof button.releasePointerCapture === 'function'
  ) {
    try {
      button.releasePointerCapture(event.pointerId);
    } catch {}
  }

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
