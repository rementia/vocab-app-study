import { normalizeWordRecordMap } from "./wordIdentity.js";

const MARK_MODES = new Set(["favorites", "difficults"]);

function readStorageValues(storageKeys, safeGetItem) {
  return Object.fromEntries(
    Object.entries(storageKeys).map(([name, key]) => [name, safeGetItem(key)])
  );
}

function parseSavedObject(value, fallback = {}) {
  if (!value) return fallback;

  try {
    const parsedValue = JSON.parse(value);
    return parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)
      ? parsedValue
      : fallback;
  } catch {
    return fallback;
  }
}

function parseSavedWordRecordMap(value) {
  return normalizeWordRecordMap(parseSavedObject(value));
}

function parseSavedClampedNumber(value, fallback, min, max) {
  if (value === null) return fallback;

  const parsedValue = Number(value);
  return Number.isNaN(parsedValue)
    ? fallback
    : Math.min(Math.max(parsedValue, min), max);
}

function parseSavedBoolean(value, fallback) {
  return value === null ? fallback : value === "true";
}

function parseSavedTimestamp(value, fallback = 0) {
  return value ? Number(value) || fallback : fallback;
}

function parseSavedMode(value, fallback) {
  return MARK_MODES.has(value) ? value : fallback;
}

function parseSavedVolume(value, availableVolumes, fallback) {
  return value && availableVolumes[value] ? value : fallback;
}

export function readSavedAppState({
  storageKeys,
  safeGetItem,
  availableVolumes,
  defaults,
  getDefaultSidebarOpen,
  recallTimeRange
}) {
  const saved = readStorageValues(storageKeys, safeGetItem);

  return {
    currentVol: parseSavedVolume(saved.vol, availableVolumes, defaults.currentVol),
    currentMode: parseSavedMode(saved.mode, defaults.currentMode),
    sidebarOpen: parseSavedBoolean(saved.sidebarOpen, getDefaultSidebarOpen()),
    speechSync: parseSavedBoolean(saved.speechSync, defaults.speechSync),
    indexByVol: { ...defaults.indexByVol, ...parseSavedObject(saved.indexByVol) },
    favorites: parseSavedWordRecordMap(saved.favorites),
    difficults: parseSavedWordRecordMap(saved.difficults),
    reviewScores: parseSavedWordRecordMap(saved.reviewScores),
    favoritesUpdatedAt: parseSavedTimestamp(saved.favoritesUpdatedAt, defaults.favoritesUpdatedAt),
    difficultsUpdatedAt: parseSavedTimestamp(saved.difficultsUpdatedAt, defaults.difficultsUpdatedAt),
    challengeMode: parseSavedBoolean(saved.challengeMode, defaults.challengeMode),
    challengeTime: parseSavedClampedNumber(
      saved.challengeTime,
      defaults.challengeTime,
      recallTimeRange.min,
      recallTimeRange.max
    ),
    displayTime: parseSavedClampedNumber(
      saved.displayTime,
      defaults.displayTime,
      recallTimeRange.min,
      recallTimeRange.max
    ),
    translationMode: parseSavedBoolean(saved.translationMode, defaults.translationMode),
    multipleChoiceMode: parseSavedBoolean(saved.multipleChoiceMode, defaults.multipleChoiceMode),
    randomMode: parseSavedBoolean(saved.randomMode, defaults.randomMode),
    frequencyMode: parseSavedBoolean(saved.frequencyMode, defaults.frequencyMode),
    shouldResetAutoPlay: saved.autoPlay !== null
  };
}
