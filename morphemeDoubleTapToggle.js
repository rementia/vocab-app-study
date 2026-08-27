const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE_PX = 24;

let lastTouchUpAt = 0;
let lastTouchX = 0;
let lastTouchY = 0;
let lastTouchAction = null;

function isPanelOpen(panel) {
  return panel instanceof HTMLElement && !panel.hidden;
}

function getMorphemeButton() {
  const button = document.getElementById('morphemeBtn');
  return button instanceof HTMLButtonElement && !button.disabled ? button : null;
}

function toggleMorphemeMode() {
  getMorphemeButton()?.click();
}

function isPanelTarget(target, panel) {
  return target instanceof Element && panel.contains(target);
}

function isBackgroundTarget(target) {
  if (!(target instanceof Element)) return false;

  return target.matches('.main, .main-layout, .center-box');
}

function getDoubleTapAction(target, panel) {
  if (isPanelOpen(panel)) {
    return isPanelTarget(target, panel) ? 'close' : null;
  }

  return isBackgroundTarget(target) ? 'open' : null;
}

function handleDoubleClick(event, panel) {
  const action = getDoubleTapAction(event.target, panel);
  if (!action) return;

  event.preventDefault();
  toggleMorphemeMode();
}

function handleTouchPointerUp(event, panel) {
  if (event.pointerType !== 'touch' || !event.isPrimary) return;

  const action = getDoubleTapAction(event.target, panel);
  if (!action) {
    lastTouchUpAt = 0;
    lastTouchAction = null;
    return;
  }

  const now = performance.now();
  const elapsed = now - lastTouchUpAt;
  const distance = Math.hypot(event.clientX - lastTouchX, event.clientY - lastTouchY);
  const isDoubleTap =
    lastTouchUpAt > 0 &&
    lastTouchAction === action &&
    elapsed <= DOUBLE_TAP_MS &&
    distance <= DOUBLE_TAP_DISTANCE_PX;

  lastTouchUpAt = now;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;
  lastTouchAction = action;

  if (!isDoubleTap) return;

  lastTouchUpAt = 0;
  lastTouchAction = null;
  event.preventDefault();
  toggleMorphemeMode();
}

export function initMorphemeDoubleTapToggle() {
  const panel = document.getElementById('morphemeAnalysisPanel');
  if (!panel || document.documentElement.dataset.morphemeDoubleTapToggleBound === 'true') return;

  document.documentElement.dataset.morphemeDoubleTapToggleBound = 'true';
  document.addEventListener('dblclick', (event) => handleDoubleClick(event, panel));
  document.addEventListener('pointerup', (event) => handleTouchPointerUp(event, panel));
}
