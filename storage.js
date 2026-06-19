const STORAGE_PREFIX = "vocab_app_study";
const LEGACY_STORAGE_PREFIX = "tango";
const STORAGE_KEY_NAMES = {
  vol: "current_vol",
  mode: "current_mode",
  indexByVol: "index_by_vol",
  sidebarOpen: "sidebar_open",
  speechSync: "auto_speak",
  favorites: "favorites",
  favoritesUpdatedAt: "favorites_updated_at",
  difficults: "difficults",
  difficultsUpdatedAt: "difficults_updated_at",
  reviewScores: "review_scores",
  challengeMode: "challenge_mode",
  challengeTime: "challenge_time",
  displayTime: "display_time",
  translationMode: "translation_mode",
  multipleChoiceMode: "multiple_choice_mode",
  autoPlay: "auto_play",
  randomMode: "random_mode",
  frequencyMode: "frequency_mode"
};

function makeStorageKey(name) {
  return `${STORAGE_PREFIX}_${name}`;
}

function makeLegacyStorageKey(name) {
  return `${LEGACY_STORAGE_PREFIX}_${name}`;
}

export const STORAGE_KEYS = Object.fromEntries(
  Object.entries(STORAGE_KEY_NAMES).map(([name, keyName]) => [name, makeStorageKey(keyName)])
);

export const LEGACY_STORAGE_KEYS = Object.fromEntries(
  Object.entries(STORAGE_KEY_NAMES).map(([name, keyName]) => [name, makeLegacyStorageKey(keyName)])
);

const LEGACY_KEY_BY_KEY = Object.fromEntries(
  Object.keys(STORAGE_KEYS).map((name) => [STORAGE_KEYS[name], LEGACY_STORAGE_KEYS[name]])
);

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`localStorage write failed for ${key}:`, error);
  }
}

export function safeGetItem(key) {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) return value;

    const legacyKey = LEGACY_KEY_BY_KEY[key];
    return legacyKey ? localStorage.getItem(legacyKey) : null;
  } catch (error) {
    console.warn(`localStorage read failed for ${key}:`, error);
    return null;
  }
}

function saveTextValue(key, value) {
  safeSetItem(key, String(value));
}

function saveJsonValue(key, value) {
  safeSetItem(key, JSON.stringify(value));
}

export function saveCurrentVol(value) {
  saveTextValue(STORAGE_KEYS.vol, value);
}

export function saveCurrentModeState(value) {
  saveTextValue(STORAGE_KEYS.mode, value);
}

export function saveIndexByVol(value) {
  saveJsonValue(STORAGE_KEYS.indexByVol, value);
}

export function saveSidebarState(value) {
  saveTextValue(STORAGE_KEYS.sidebarOpen, value);
}

export function saveSpeechSyncState(value) {
  saveTextValue(STORAGE_KEYS.speechSync, value);
}

export function saveFavoritesToLocalOnly(value) {
  saveJsonValue(STORAGE_KEYS.favorites, value);
}

export function saveFavoritesUpdatedAt(value) {
  saveTextValue(STORAGE_KEYS.favoritesUpdatedAt, value);
}

export function saveDifficultsToLocalOnly(value) {
  saveJsonValue(STORAGE_KEYS.difficults, value);
}

export function saveDifficultsUpdatedAt(value) {
  saveTextValue(STORAGE_KEYS.difficultsUpdatedAt, value);
}

export function saveReviewScoresToLocalOnly(value) {
  saveJsonValue(STORAGE_KEYS.reviewScores, value);
}

export function saveChallengeModeState(value) {
  saveTextValue(STORAGE_KEYS.challengeMode, value);
}

export function saveChallengeTimeState(value) {
  saveTextValue(STORAGE_KEYS.challengeTime, value);
}

export function saveDisplayTimeState(value) {
  saveTextValue(STORAGE_KEYS.displayTime, value);
}

export function saveTranslationModeState(value) {
  saveTextValue(STORAGE_KEYS.translationMode, value);
}

export function saveMultipleChoiceModeState(value) {
  saveTextValue(STORAGE_KEYS.multipleChoiceMode, value);
}

export function saveAutoPlayState(value) {
  saveTextValue(STORAGE_KEYS.autoPlay, value);
}

export function saveRandomModeState(value) {
  saveTextValue(STORAGE_KEYS.randomMode, value);
}

export function saveFrequencyModeState(value) {
  saveTextValue(STORAGE_KEYS.frequencyMode, value);
}
