import { getLastBuiltMultipleChoiceQuestion } from './multipleChoice.js?v=20260922-1';

const LONG_PRESS_MS = 600;
const MOVE_TOLERANCE_PX = 28;
const CLICK_SUPPRESSION_MS = 1000;

let pressTimer = null;
let activePress = null;
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
  activePress = null;
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
  if (!item) return false;

  suppressClickButton = button;
  scheduleClickSuppressionReset();

  const optionsEl = button.closest('#multipleChoiceOptions');
  if (!(optionsEl instanceof HTMLElement)) return false;

  optionsEl.dispatchEvent(new CustomEvent('multiple-choice-etymology-open', {
    bubbles: false,
    detail: { item }
  }));
  return true;
}

function scheduleLongPress(button) {
  clearPressTimer();
  pressTimer = window.setTimeout(() => {
    pressTimer = null;
    if (openAnalysisForChoice(button) && activePress) {
      activePress.fired = true;
    }
  }, LONG_PRESS_MS);
}

function isPointInsideButton(clientX, clientY, button) {
  if (!(button instanceof HTMLElement)) return false;
  const rect = button.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function handlePointerDown(event, optionsEl) {
  if (!event.isPrimary || event.button > 0) return;

  const button = getOptionButton(event.target);
  if (!(button instanceof HTMLElement)) return;

  event.preventDefault();
  clearActivePress();

  const answered = isAnswered(optionsEl);

  activePress = {
    pointerId: event.pointerId,
    button,
    answered,
    startX: event.clientX,
    startY: event.clientY,
    moved: false,
    fired: false
  };

  try {
    button.setPointerCapture?.(event.pointerId);
  } catch (_) {
    // Pointer capture is an optimization; the delegated listeners still provide fallback handling.
  }

  if (answered && getAnalysisItem(button)) {
    scheduleLongPress(button);
  }
}

function handlePointerMove(event) {
  const state = activePress;
  if (!state || event.pointerId !== state.pointerId) return;

  const distance = Math.hypot(
    event.clientX - state.startX,
    event.clientY - state.startY
  );
  const stillInside = isPointInsideButton(event.clientX, event.clientY, state.button);

  if (!stillInside && distance > MOVE_TOLERANCE_PX) {
    state.moved = true;
    clearPressTimer();
  }
}

function releasePointerCaptureSafely(state) {
  try {
    if (state?.button?.hasPointerCapture?.(state.pointerId)) {
      state.button.releasePointerCapture(state.pointerId);
    }
  } catch (_) {
    // Ignore capture-release failures after DOM updates.
  }
}

function handlePointerUp(event) {
  const state = activePress;
  if (!state || event.pointerId !== state.pointerId) return;

  event.preventDefault();
  clearPressTimer();

  const endedInsideSameButton = isPointInsideButton(
    event.clientX,
    event.clientY,
    state.button
  );

  releasePointerCaptureSafely(state);
  activePress = null;

  if (state.fired) return;

  // 解答前後とも、押し始めた同じ選択肢の枠内で離した場合だけ通常 click を成立させる。
  // 長押し用の移動判定は、短押しを不必要に失敗させない。
  if (endedInsideSameButton) {
    state.button.click();
  }
}

function handlePointerCancel(event) {
  const state = activePress;
  if (!state || event.pointerId !== state.pointerId) return;

  releasePointerCaptureSafely(state);
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

function preventNativeChoiceInteraction(event) {
  const button = getOptionButton(event.target);
  if (!button) return;
  event.preventDefault();
}

export function initMultipleChoiceLongPressEtymology() {
  const optionsEl = document.getElementById('multipleChoiceOptions');
  if (!optionsEl || optionsEl.dataset.longPressEtymologyBound === 'true') return;

  optionsEl.dataset.longPressEtymologyBound = 'true';

  optionsEl.addEventListener('pointerdown', (event) => handlePointerDown(event, optionsEl));
  optionsEl.addEventListener('pointermove', handlePointerMove);
  optionsEl.addEventListener('pointerup', handlePointerUp);
  optionsEl.addEventListener('pointercancel', handlePointerCancel);

  optionsEl.addEventListener('click', handleClickCapture, true);

  optionsEl.addEventListener('contextmenu', preventNativeChoiceInteraction);
  optionsEl.addEventListener('selectstart', preventNativeChoiceInteraction);
  optionsEl.addEventListener('dragstart', preventNativeChoiceInteraction);
}
