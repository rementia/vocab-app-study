import { normalizeWord } from './data.js';
import { safeGetItem, safeSetItem } from './storage.js';

let pronunciationEl = null;
let currentPronunciationController = null;
let lastPronunciationRequest = "";
let getCurrentWordFn = null;

export function initPronunciation({ el, getCurrentWord }) {
  pronunciationEl = el;
  getCurrentWordFn = getCurrentWord;
}

export function updateSpeechButtonAvailability(speakBtnEl) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if (!speakBtnEl) return;

  speakBtnEl.disabled = !supported;
  speakBtnEl.classList.toggle('is-disabled', !supported);
  speakBtnEl.title = supported ? '発音' : 'この端末では発音未対応';
}

export function speakWord() {
  if (!getCurrentWordFn) return;
  const current = getCurrentWordFn();
  if (!current) return;
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(current.word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export async function loadPronunciation(word) {
  if (!pronunciationEl) return;

  const normalizedWord = normalizeWord(word);
  const key = `portfolio_pron_${normalizedWord}`;
  lastPronunciationRequest = normalizedWord;

  const cached = safeGetItem(key);
  if (cached !== null) {
    pronunciationEl.textContent = cached || '発音記号なし';
    return;
  }

  if (currentPronunciationController) {
    currentPronunciationController.abort();
  }

  currentPronunciationController = new AbortController();
  pronunciationEl.textContent = '…';

  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      { signal: currentPronunciationController.signal }
    );
    const data = await response.json();

    let phonetic = '';
    if (Array.isArray(data) && data[0]) {
      if (data[0].phonetic) {
        phonetic = data[0].phonetic;
      } else if (Array.isArray(data[0].phonetics)) {
        const found = data[0].phonetics.find((item) => item && item.text);
        phonetic = found ? found.text : '';
      }
    }

    phonetic = phonetic.replace(/^\/|\/$/g, '');
    if (phonetic) {
      safeSetItem(key, phonetic);
    }

    const current = getCurrentWordFn ? getCurrentWordFn() : null;
    const currentWord = current ? normalizeWord(current.word) : '';
    if (lastPronunciationRequest === normalizedWord && currentWord === normalizedWord) {
      pronunciationEl.textContent = phonetic || '発音記号なし';
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      const current = getCurrentWordFn ? getCurrentWordFn() : null;
      const currentWord = current ? normalizeWord(current.word) : '';
      if (lastPronunciationRequest === normalizedWord && currentWord === normalizedWord) {
        pronunciationEl.textContent = '発音記号なし';
      }
    }
  }
}
