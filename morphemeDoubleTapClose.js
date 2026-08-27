const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE_PX = 24;

let lastTouchUpAt = 0;
let lastTouchX = 0;
let lastTouchY = 0;

function isPanelOpen(panel) {
  return panel instanceof HTMLElement && !panel.hidden;
}

function closeMorphemePanel(panel) {
  if (!isPanelOpen(panel)) return;

  const morphemeButton = document.getElementById('morphemeBtn');
  if (!(morphemeButton instanceof HTMLButtonElement) || morphemeButton.disabled) return;

  morphemeButton.click();
}

function handleDoubleClick(event, panel) {
  if (!isPanelOpen(panel)) return;
  if (!(event.target instanceof Element) || !event.target.closest('#morphemeAnalysisPanel')) return;

  event.preventDefault();
  closeMorphemePanel(panel);
}

function handleTouchPointerUp(event, panel) {
  if (event.pointerType !== 'touch' || !event.isPrimary || !isPanelOpen(panel)) return;

  const now = performance.now();
  const elapsed = now - lastTouchUpAt;
  const distance = Math.hypot(event.clientX - lastTouchX, event.clientY - lastTouchY);
  const isDoubleTap = lastTouchUpAt > 0 && elapsed <= DOUBLE_TAP_MS && distance <= DOUBLE_TAP_DISTANCE_PX;

  lastTouchUpAt = now;
  lastTouchX = event.clientX;
  lastTouchY = event.clientY;

  if (!isDoubleTap) return;

  lastTouchUpAt = 0;
  event.preventDefault();
  closeMorphemePanel(panel);
}

export function initMorphemeDoubleTapClose() {
  const panel = document.getElementById('morphemeAnalysisPanel');
  if (!panel || panel.dataset.doubleTapCloseBound === 'true') return;

  panel.dataset.doubleTapCloseBound = 'true';
  panel.addEventListener('dblclick', (event) => handleDoubleClick(event, panel));
  panel.addEventListener('pointerup', (event) => handleTouchPointerUp(event, panel));
}
