import { normalizeWordKey } from './wordIdentity.js';
import { safeGetItem, safeSetItem } from './storage.js';

let pronunciationEl = null;
let currentPronunciationController = null;
let lastPronunciationRequest = "";
let getCurrentWordFn = null;
const PRONUNCIATION_CACHE_PREFIX = "vocab_app_study_pron";
const LEGACY_PRONUNCIATION_CACHE_PREFIX = "portfolio_pron";

export function initPronunciation({ el, getCurrentWord }) {
  pronunciationEl = el;
  getCurrentWordFn = getCurrentWord;
}

export function updateSpeechButtonAvailability(speakBtnEl) {
  const supported = isSpeechSynthesisSupported();
  if (!speakBtnEl) return;

  speakBtnEl.disabled = !supported;
  speakBtnEl.classList.toggle('is-disabled', !supported);
  speakBtnEl.title = supported ? '発音' : 'この端末では発音未対応';
}

export function speakWord() {
  if (!getCurrentWordFn) return;
  const current = getCurrentWordFn();
  if (!current) return;
  if (!isSpeechSynthesisSupported()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(current.word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

export async function loadPronunciation(word) {
  if (!pronunciationEl) return;

  const normalizedWord = normalizeWordKey(word);
  const key = makePronunciationCacheKey(normalizedWord);
  lastPronunciationRequest = normalizedWord;

  const cached = getCachedPronunciation(normalizedWord);
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
    const data = await fetchPronunciationData(word, currentPronunciationController.signal);
    const phonetic = extractPhonetic(data);
    if (phonetic) {
      safeSetItem(key, phonetic);
    }

    if (isCurrentPronunciationRequest(normalizedWord)) {
      pronunciationEl.textContent = phonetic || '発音記号なし';
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      if (isCurrentPronunciationRequest(normalizedWord)) {
        pronunciationEl.textContent = '発音記号なし';
      }
    }
  }
}

async function fetchPronunciationData(word, signal) {
  const response = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    { signal }
  );

  if (response.ok === false) {
    return null;
  }

  return response.json();
}

function isSpeechSynthesisSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

function extractPhonetic(data) {
  if (!Array.isArray(data) || !data[0]) return '';

  const entry = data[0];
  const phonetic = entry.phonetic || findPhoneticText(entry.phonetics);
  return phonetic.replace(/^\/|\/$/g, '');
}

function findPhoneticText(phonetics) {
  if (!Array.isArray(phonetics)) return '';

  const found = phonetics.find((item) => item && item.text);
  return found ? found.text : '';
}

function isCurrentPronunciationRequest(normalizedWord) {
  const current = getCurrentWordFn ? getCurrentWordFn() : null;
  const currentWord = current ? normalizeWordKey(current.word) : '';
  return lastPronunciationRequest === normalizedWord && currentWord === normalizedWord;
}

function makePronunciationCacheKey(normalizedWord) {
  return `${PRONUNCIATION_CACHE_PREFIX}_${normalizedWord}`;
}

function makeLegacyPronunciationCacheKey(normalizedWord) {
  return `${LEGACY_PRONUNCIATION_CACHE_PREFIX}_${normalizedWord}`;
}

function getCachedPronunciation(normalizedWord) {
  const cached = safeGetItem(makePronunciationCacheKey(normalizedWord));
  return cached !== null
    ? cached
    : safeGetItem(makeLegacyPronunciationCacheKey(normalizedWord));
}
