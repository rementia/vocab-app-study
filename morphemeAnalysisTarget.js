let morphemeAnalysisTarget = null;

function normalizeWord(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function setMorphemeAnalysisTarget(item) {
  morphemeAnalysisTarget = item && normalizeWord(item.word) ? item : null;
}

export function clearMorphemeAnalysisTarget() {
  morphemeAnalysisTarget = null;
}

export function getMorphemeAnalysisTarget() {
  if (!morphemeAnalysisTarget) return null;

  if (typeof document === 'undefined') {
    return morphemeAnalysisTarget;
  }

  const panel = document.getElementById('morphemeAnalysisPanel');
  const heading = panel?.querySelector('.morpheme-analysis-word');
  const displayedWord = normalizeWord(heading?.textContent);
  const targetWord = normalizeWord(morphemeAnalysisTarget.word);

  if (panel instanceof HTMLElement && !panel.hidden && displayedWord === targetWord) {
    return morphemeAnalysisTarget;
  }

  morphemeAnalysisTarget = null;
  return null;
}
