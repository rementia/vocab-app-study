import { normalizeWordKey } from './wordIdentity.js';
import { safeGetItem, safeSetItem } from './storage.js';

let pronunciationEl = null;
let currentPronunciationController = null;
let currentPronunciationAudio = null;
let lastPronunciationRequest = "";
let getCurrentWordFn = null;
const pronunciationMissCache = new Set();
const PRONUNCIATION_CACHE_PREFIX = "vocab_app_study_pron";
const LEGACY_PRONUNCIATION_CACHE_PREFIX = "portfolio_pron";
const VERIFIED_PRONUNCIATION_STATUS = "verified";
const REVIEW_REQUIRED_STATUSES = new Set(["needs_review", "invalid_compound_entry"]);
let audioUnlocked = false;
let audioUnlockEventsBound = false;
let audioUnlockAttempted = false;
let audioUnlockInProgress = false;

export function initPronunciation({ el, getCurrentWord }) {
  pronunciationEl = el;
  getCurrentWordFn = getCurrentWord;
  audioUnlocked = hasUserActivation();
  audioUnlockAttempted = false;
  audioUnlockInProgress = false;
  bindAudioUnlockEvents();
}

export function updateSpeechButtonAvailability(speakBtnEl) {
  const supported = isHtmlAudioSupported() || isSpeechSynthesisSupported();
  if (!speakBtnEl) return;

  speakBtnEl.disabled = !supported;
  speakBtnEl.classList.toggle('is-disabled', !supported);
  speakBtnEl.title = supported ? '発音' : 'この端末では発音未対応';
}

export function speakWord() {
  return safePlayPronunciation();
}

export function safePlayPronunciation() {
  if (!getCurrentWordFn) return;
  const current = getCurrentWordFn();
  if (!current) return;

  const verifiedAudioUrl = normalizeField(current.pronunciationAudioUrl);
  if (verifiedAudioUrl && isHtmlAudioSupported()) {
    return playVerifiedAudio(verifiedAudioUrl, current.word);
  }

  return playSpeechSynthesisFallback(current.word);
}

function playVerifiedAudio(url, fallbackWord) {
  try {
    stopCurrentPronunciationAudio();
    window.speechSynthesis?.cancel?.();

    const audio = new Audio(url);
    currentPronunciationAudio = audio;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((error) => {
        console.warn("検証済み発音音声の再生に失敗しました。ブラウザTTSへフォールバックします:", error);
        if (currentPronunciationAudio === audio) currentPronunciationAudio = null;
        playSpeechSynthesisFallback(fallbackWord);
      });
    }
    return { ok: true };
  } catch (error) {
    console.warn("検証済み発音音声の再生に失敗しました。ブラウザTTSへフォールバックします:", error);
    return playSpeechSynthesisFallback(fallbackWord);
  }
}

function playSpeechSynthesisFallback(word) {
  if (!isSpeechSynthesisSupported()) return { ok: false, unsupported: true };

  if (!audioUnlocked && !hasUserActivation()) {
    console.warn("発音再生はユーザー操作後に有効化できます: NotAllowedError");
    bindAudioUnlockEvents();
    return { ok: false, blocked: true };
  }

  audioUnlocked = true;
  audioUnlockAttempted = true;
  unbindAudioUnlockEvents();

  try {
    stopCurrentPronunciationAudio();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return { ok: true };
  } catch (error) {
    console.warn("ブラウザTTSによる発音再生に失敗しました:", error);
    if (error?.name === "NotAllowedError") {
      audioUnlocked = false;
      bindAudioUnlockEvents();
      return { ok: false, blocked: true };
    }
    return { ok: false, blocked: false };
  }
}

function stopCurrentPronunciationAudio() {
  if (!currentPronunciationAudio) return;
  try {
    currentPronunciationAudio.pause();
    currentPronunciationAudio.currentTime = 0;
  } catch (error) {
    console.warn("発音音声の停止に失敗しました:", error);
  }
  currentPronunciationAudio = null;
}

export function unlockPronunciationAudioOnce() {
  if (audioUnlocked && audioUnlockAttempted) {
    unbindAudioUnlockEvents();
    return { ok: true, unlocked: true, attempted: false };
  }

  if (audioUnlockInProgress) {
    return { ok: false, unlocked: audioUnlocked, attempted: false, inProgress: true };
  }

  if (!isSpeechSynthesisSupported()) {
    return { ok: false, unlocked: false, attempted: false, unsupported: true };
  }

  if (!hasUserActivation()) {
    bindAudioUnlockEvents();
    return { ok: false, unlocked: false, attempted: false, blocked: true };
  }

  audioUnlockInProgress = true;
  audioUnlockAttempted = true;

  try {
    if (typeof window.speechSynthesis.resume === "function") {
      window.speechSynthesis.resume();
    }
    audioUnlocked = true;
    unbindAudioUnlockEvents();
    return { ok: true, unlocked: true, attempted: true };
  } catch (error) {
    console.warn("発音再生の有効化に失敗しました:", error);
    audioUnlocked = false;
    bindAudioUnlockEvents();
    return { ok: false, unlocked: false, attempted: true, blocked: error?.name === "NotAllowedError" };
  } finally {
    audioUnlockInProgress = false;
  }
}

export function getPronunciationAudioUnlockState() {
  return {
    isAudioUnlocked: audioUnlocked,
    unlockAttempted: audioUnlockAttempted,
    unlockInProgress: audioUnlockInProgress
  };
}

export async function loadPronunciation(word) {
  if (!pronunciationEl) return;

  const normalizedWord = normalizeWordKey(word);
  const key = makePronunciationCacheKey(normalizedWord);
  lastPronunciationRequest = normalizedWord;

  const current = getCurrentWordFor(normalizedWord);
  if (current) {
    const verifiedPhonetic = getVerifiedPhonetic(current);
    if (verifiedPhonetic) {
      pronunciationEl.textContent = verifiedPhonetic;
      return;
    }

    if (requiresPronunciationReview(current)) {
      pronunciationEl.textContent = '発音記号要確認';
      return;
    }
  }

  // Legacy fallback only. Audited rows explicitly marked needs_review or
  // invalid_compound_entry never accept an external API result as final data.
  const cached = getCachedPronunciation(normalizedWord);
  if (cached !== null) {
    pronunciationEl.textContent = cached || '発音記号なし';
    return;
  }

  if (pronunciationMissCache.has(normalizedWord)) {
    pronunciationEl.textContent = '発音記号なし';
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
    } else {
      pronunciationMissCache.add(normalizedWord);
    }

    if (isCurrentPronunciationRequest(normalizedWord)) {
      pronunciationEl.textContent = phonetic || '発音記号なし';
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      pronunciationMissCache.add(normalizedWord);
      if (isCurrentPronunciationRequest(normalizedWord)) {
        pronunciationEl.textContent = '発音記号なし';
      }
    }
  }
}

function getCurrentWordFor(normalizedWord) {
  const current = getCurrentWordFn ? getCurrentWordFn() : null;
  if (!current || normalizeWordKey(current.word) !== normalizedWord) return null;
  return current;
}

function getVerifiedPhonetic(item) {
  if (!isVerifiedPronunciation(item)) return '';
  return normalizePhoneticText(item.phonetic);
}

function isVerifiedPronunciation(item) {
  return normalizeField(item?.pronunciationStatus).toLowerCase() === VERIFIED_PRONUNCIATION_STATUS;
}

function requiresPronunciationReview(item) {
  return REVIEW_REQUIRED_STATUSES.has(normalizeField(item?.pronunciationStatus).toLowerCase());
}

function normalizeField(value) {
  return String(value ?? '').trim();
}

function normalizePhoneticText(value) {
  return String(value || '').trim().replace(/^[/[]+|[\/\]]+$/g, '');
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

function isHtmlAudioSupported() {
  return typeof Audio !== 'undefined';
}

function isSpeechSynthesisSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window
  );
}

function hasUserActivation() {
  if (typeof navigator === "undefined" || !navigator.userActivation) return true;
  return navigator.userActivation.hasBeenActive || navigator.userActivation.isActive;
}

function bindAudioUnlockEvents() {
  if (audioUnlockEventsBound || typeof document === "undefined") return;
  audioUnlockEventsBound = true;
  document.addEventListener("pointerdown", handleAudioUnlockRequest, true);
  document.addEventListener("touchstart", handleAudioUnlockRequest, true);
  document.addEventListener("click", handleAudioUnlockRequest, true);
  document.addEventListener("keydown", handleAudioUnlockRequest, true);
}

function unbindAudioUnlockEvents() {
  if (!audioUnlockEventsBound || typeof document === "undefined") return;
  audioUnlockEventsBound = false;
  document.removeEventListener("pointerdown", handleAudioUnlockRequest, true);
  document.removeEventListener("touchstart", handleAudioUnlockRequest, true);
  document.removeEventListener("click", handleAudioUnlockRequest, true);
  document.removeEventListener("keydown", handleAudioUnlockRequest, true);
}

function handleAudioUnlockRequest() {
  unlockPronunciationAudioOnce();
}

function extractPhonetic(data) {
  if (!Array.isArray(data) || !data[0]) return '';

  const entry = data[0];
  const phonetic = entry.phonetic || findPhoneticText(entry.phonetics);
  return normalizePhoneticText(phonetic);
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
