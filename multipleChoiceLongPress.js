import { getLastBuiltMultipleChoiceQuestion } from './multipleChoice.js?v=20260922-1';

const LONG_PRESS_MS = 480;
const MOVE_TOLERANCE_PX = 28;
const CLICK_SUPPRESSION_MS = 1000;

let pressTimer = null;
let activePointerId = null;
let activePointerButton = null;
let activeTouch = null;
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

function clearPointerPress() {
  clearPressTimer();
  activePointerId = null;
  activePointerButton = null;
}

function clearTouchPress() {
  clearPressTimer();
  activeTouch = null;
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

function scheduleLongPress(button, onFire) {
  clearPressTimer();
  pressTimer = window.setTimeout(() => {
    pressTimer = null;
    if (openAnalysisForChoice(button)) onFire?.();
  }, LONG_PRESS_MS);
}

function handlePointerDown(event, optionsEl) {
  if (event.pointerType === 'touch' || !event.isPrimary || !isAnswered(optionsEl)) return;

  const button = getOptionButton(event.target);
  if (!(button instanceof HTMLElement) || !getAnalysisItem(button)) return;

  clearPointerPress();
  activePointerId = event.pointerId;
  activePointerButton = button;
  startX = event.clientX;
  startY = event.clientY;
  scheduleLongPress(button);
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

function handlePointerMove(event) {
  if (event.pointerId !== activePointerId || pressTimer === null) return;

  const distance = Math.hypot(event.clientX - startX, event.clientY - startY);
  const stillInside = isPointInsideButton(event.clientX, event.clientY, activePointerButton);

  // 同じ選択肢内の手ブレは許容する。枠外へ出たうえで明確に動いた時だけ長押しを解除。
  if (!stillInside && distance > MOVE_TOLERANCE_PX) {
    clearPointerPress();
  }
}

function handlePointerEnd(event) {
  if (event.pointerId !== activePointerId) return;
  clearPointerPress();
}

function handleTouchStart(event, optionsEl) {
  const button = getOptionButton(event.target);
  const touch = event.touches?.[0];
  if (!(button instanceof HTMLElement) || !touch) return;

  const answered = isAnswered(optionsEl);

  // iOS Safari のネイティブ長押し選択・コールアウトと合成 click を抑止し、
  // 解答前後とも touchend 側で「どこで指を離したか」を判定する。
  event.preventDefault();
  clearTouchPress();

  activeTouch = {
    button,
    answered,
    startX: touch.clientX,
    startY: touch.clientY,
    moved: false,
    fired: false
  };

  // 語源解析は解答後のみ。
  if (!answered || !getAnalysisItem(button)) return;

  scheduleLongPress(button, () => {
    if (activeTouch) activeTouch.fired = true;
  });
}

function handleTouchMove(event) {
  const state = activeTouch;
  const touch = event.touches?.[0];
  if (!state || !touch) return;

  event.preventDefault();
  const distance = Math.hypot(
    touch.clientX - state.startX,
    touch.clientY - state.startY
  );
  const stillInside = isPointInsideButton(touch.clientX, touch.clientY, state.button);

  // 指の微動では解除しない。選択肢の外へ明確にドラッグした場合のみ解除する。
  if (!stillInside && distance > MOVE_TOLERANCE_PX) {
    state.moved = true;
    clearPressTimer();
  }
}

function isTouchEndInsideButton(event, button) {
  const touch = event.changedTouches?.[0];
  if (!touch || !(button instanceof HTMLElement)) return false;

  const endTarget = document.elementFromPoint(touch.clientX, touch.clientY);
  return endTarget instanceof Element && Boolean(endTarget.closest('.multiple-choice-option') === button);
}

function handleTouchEnd(event) {
  const state = activeTouch;
  if (!state) return;

  event.preventDefault();
  clearPressTimer();
  activeTouch = null;

  if (state.fired) return;

  const endedInsideSameButton = isTouchEndInsideButton(event, state.button);

  if (!state.answered) {
    // 解答前は「押し始めた選択肢の枠内で離した」ときだけ回答する。
    // 枠外へスライドして離した場合は、移動量にかかわらず無回答。
    if (endedInsideSameButton) state.button.click();
    return;
  }

  if (state.moved || !endedInsideSameButton) return;

  // 解答後の短押しは既存 click 処理へ戻す。
  state.button.click();
}

function handleTouchCancel(event) {
  if (!activeTouch) return;
  event.preventDefault();
  clearTouchPress();
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

  // Desktop / mouse.
  optionsEl.addEventListener('pointerdown', (event) => handlePointerDown(event, optionsEl));
  optionsEl.addEventListener('pointermove', handlePointerMove);
  optionsEl.addEventListener('pointerup', handlePointerEnd);
  optionsEl.addEventListener('pointercancel', handlePointerEnd);

  // iPhone / iPad Safari: Pointer Events だけに依存しない。
  optionsEl.addEventListener('touchstart', (event) => handleTouchStart(event, optionsEl), { passive: false });
  optionsEl.addEventListener('touchmove', handleTouchMove, { passive: false });
  optionsEl.addEventListener('touchend', handleTouchEnd, { passive: false });
  optionsEl.addEventListener('touchcancel', handleTouchCancel, { passive: false });

  optionsEl.addEventListener('click', handleClickCapture, true);

  // 文字選択・コールアウトは禁止。解答前後で同じ仕様。
  optionsEl.addEventListener('contextmenu', preventNativeChoiceInteraction);
  optionsEl.addEventListener('selectstart', preventNativeChoiceInteraction);
  optionsEl.addEventListener('dragstart', preventNativeChoiceInteraction);
}
