import { normalizeWordKey } from './wordIdentity.js';
import { safeGetItem, safeSetItem } from './storage.js';

let pronunciationEl = null;
let currentPronunciationController = null;
let currentPronunciationAudio = null;
let lastPronunciationRequest = "";
let getCurrentWordFn = null;
let pronunciationTargetOverride = null;
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
  pronunciationTargetOverride = null;
  audioUnlocked = hasUserActivation();
  audioUnlockAttempted = false;
  audioUnlockInProgress = false;
  bindAudioUnlockEvents();
}

export function setPronunciationTargetOverride(item) {
  pronunciationTargetOverride = item && normalizeField(item.word) ? item : null;
}

export function clearPronunciationTargetOverride() {
  pronunciationTargetOverride = null;
}

function getEffectivePronunciationTarget() {
  if (pronunciationTargetOverride) {
    const panel = typeof document !== 'undefined'
      ? document.getElementById('morphemeAnalysisPanel')
      : null;
    const heading = panel?.querySelector('.morpheme-analysis-word');
    const displayedWord = normalizeWordKey(heading?.textContent || '');
    const overrideWord = normalizeWordKey(pronunciationTargetOverride.word);

    if (
      typeof HTMLElement !== 'undefined' &&
      panel instanceof HTMLElement &&
      !panel.hidden &&
      displayedWord === overrideWord
    ) {
      return pronunciationTargetOverride;
    }

    pronunciationTargetOverride = null;
  }

  return getCurrentWordFn ? getCurrentWordFn() : null;
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
  const current = getEffectivePronunciationTarget();
  if (!current) return;

  // A pronunciationAudioUrl is used only after the row itself has been
  // pronunciation-audited. This allows freely licensed human recordings to
  // override TTS without trusting an unaudited external URL.
  if (isVerifiedPronunciation(current)) {
    const verifiedAudioUrl = normalizeField(current.pronunciationAudioUrl);
    if (verifiedAudioUrl && isHtmlAudioSupported()) {
      return playVerifiedAudio(verifiedAudioUrl, current.word);
    }
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
        console.warn("検証済み発音音声の再生に失敗しました。端末内TTSへフォールバックします:", error);
        if (currentPronunciationAudio === audio) currentPronunciationAudio = null;
        playSpeechSynthesisFallback(fallbackWord);
      });
    }
    return { ok: true, source: 'verified-audio' };
  } catch (error) {
    console.warn("検証済み発音音声の再生に失敗しました。端末内TTSへフォールバックします:", error);
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
    const preferredVoice = selectPreferredAmericanEnglishVoice();
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang || 'en-US';
    } else {
      utterance.lang = 'en-US';
    }
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return {
      ok: true,
      source: 'browser-tts',
      voice: preferredVoice?.name || '',
      localService: preferredVoice?.localService ?? null
    };
  } catch (error) {
    console.warn("端末内TTSによる発音再生に失敗しました:", error);
    if (error?.name === "NotAllowedError") {
      audioUnlocked = false;
      bindAudioUnlockEvents();
      return { ok: false, blocked: true };
    }
    return { ok: false, blocked: false };
  }
}

function selectPreferredAmericanEnglishVoice() {
  if (!isSpeechSynthesisSupported() || typeof window.speechSynthesis.getVoices !== 'function') {
    return null;
  }

  const voices = window.speechSynthesis.getVoices();
  if (!Array.isArray(voices) || voices.length === 0) return null;

  const scored = voices
    .map((voice, index) => ({ voice, index, score: scoreVoice(voice) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index));

  return scored[0]?.voice || null;
}

function scoreVoice(voice) {
  const lang = normalizeLanguageTag(voice?.lang);
  const name = normalizeField(voice?.name).toLowerCase();
  let score = 0;

  // General American is the app's pronunciation baseline.
  if (lang === 'en-us') score += 100;
  else if (lang.startsWith('en-us-')) score += 95;
  else if (lang === 'en-ca') score += 65;
  else if (lang.startsWith('en-')) score += 40;
  else if (lang === 'en') score += 35;
  else return 0;

  // Prefer local voices so playback remains completely free from metered API
  // usage and does not depend on a paid cloud service owned by this app.
  if (voice?.localService === true) score += 30;
  if (voice?.default === true) score += 5;

  // Common OS/browser voice labels that usually denote higher-quality voices.
  // These are only tie-breakers; locale and local availability remain primary.
  if (/natural|enhanced|premium/.test(name)) score += 8;
  if (/microsoft|apple|google/.test(name)) score += 2;

  return score;
}

function normalizeLanguageTag(value) {
  return normalizeField(value).replace(/_/g, '-').toLowerCase();
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

  const target = getEffectivePronunciationTarget();
  const targetWord = normalizeField(target?.word) || normalizeField(word);
  const normalizedWord = normalizeWordKey(targetWord);
  const key = makePronunciationCacheKey(normalizedWord);
  lastPronunciationRequest = normalizedWord;

  const current = getPronunciationItemFor(normalizedWord);
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

  // Legacy display fallback only. Audited rows explicitly marked needs_review
  // or invalid_compound_entry never accept an external API result as final data.
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
    const data = await fetchPronunciationData(targetWord, currentPronunciationController.signal);
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

function getPronunciationItemFor(normalizedWord) {
  const current = getEffectivePronunciationTarget();
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
  const current = getEffectivePronunciationTarget();
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
