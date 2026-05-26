export const STORAGE_KEYS = {
  vol: "tango_current_vol",
  mode: "tango_current_mode",
  indexByVol: "tango_index_by_vol",
  sidebarOpen: "tango_sidebar_open",
  speechSync: "tango_auto_speak",
  favorites: "tango_favorites",
  favoritesUpdatedAt: "tango_favorites_updated_at",
  difficults: "tango_difficults",
  reviewScores: "tango_review_scores",
  challengeMode: "tango_challenge_mode",
  challengeTime: "tango_challenge_time",
  displayTime: "tango_display_time",
  translationMode: "tango_translation_mode",
  autoPlay: "tango_auto_play",
  randomMode: "tango_random_mode",
  frequencyMode: "tango_frequency_mode"
};

export function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`localStorage write failed for ${key}:`, error);
  }
}

export function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`localStorage read failed for ${key}:`, error);
    return null;
  }
}

export function saveCurrentVol(value) {
  safeSetItem(STORAGE_KEYS.vol, value);
}

export function saveCurrentModeState(value) {
  safeSetItem(STORAGE_KEYS.mode, value);
}

export function saveIndexByVol(value) {
  safeSetItem(STORAGE_KEYS.indexByVol, JSON.stringify(value));
}

export function saveSidebarState(value) {
  safeSetItem(STORAGE_KEYS.sidebarOpen, String(value));
}

export function saveSpeechSyncState(value) {
  safeSetItem(STORAGE_KEYS.speechSync, String(value));
}

export function saveFavoritesToLocalOnly(value) {
  safeSetItem(STORAGE_KEYS.favorites, JSON.stringify(value));
}

export function saveFavoritesUpdatedAt(value) {
  safeSetItem(STORAGE_KEYS.favoritesUpdatedAt, String(value));
}

export function saveDifficultsToLocalOnly(value) {
  safeSetItem(STORAGE_KEYS.difficults, JSON.stringify(value));
}

export function saveReviewScoresToLocalOnly(value) {
  safeSetItem(STORAGE_KEYS.reviewScores, JSON.stringify(value));
}

export function saveChallengeModeState(value) {
  safeSetItem(STORAGE_KEYS.challengeMode, String(value));
}

export function saveChallengeTimeState(value) {
  safeSetItem(STORAGE_KEYS.challengeTime, String(value));
}

export function saveDisplayTimeState(value) {
  safeSetItem(STORAGE_KEYS.displayTime, String(value));
}

export function saveTranslationModeState(value) {
  safeSetItem(STORAGE_KEYS.translationMode, String(value));
}

export function saveAutoPlayState(value) {
  safeSetItem(STORAGE_KEYS.autoPlay, String(value));
}

export function saveRandomModeState(value) {
  safeSetItem(STORAGE_KEYS.randomMode, String(value));
}

export function saveFrequencyModeState(value) {
  safeSetItem(STORAGE_KEYS.frequencyMode, String(value));
}
