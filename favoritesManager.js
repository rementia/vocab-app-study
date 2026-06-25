import { makeWordKey, normalizeWordKey } from "./wordIdentity.js";
import { buildMarkedWordEntries, clampIndex } from "./wordList.js";

function makeFavoriteKey(item) {
  return makeWordKey(item);
}

function getFavoriteRecordKey(favorites, item) {
  const key = makeFavoriteKey(item);
  if (favorites[key]) return key;
  if (item?.legacyWordKey && favorites[item.legacyWordKey]) return item.legacyWordKey;
  const wordKey = normalizeWordKey(item?.word);
  if (wordKey && favorites[wordKey]) return wordKey;
  return key;
}

export function isFavorite(favorites, item) {
  return !!favorites[getFavoriteRecordKey(favorites, item)];
}

export function buildFavoriteEntries(allWordsByVol, volOrder, favorites) {
  return buildMarkedWordEntries(allWordsByVol, volOrder, favorites, isFavorite);
}

function createFavoritesResult(state, updated = {}) {
  return {
    ...updated,
    currentMode: state.currentMode,
    index: state.index,
    indexByVol: state.indexByVol,
    randomMode: state.randomMode,
    frequencyMode: state.frequencyMode
  };
}

function touchFavoritesChanged(
  state,
  saveFavoritesToLocalOnly,
  saveFavoritesUpdatedAt,
  clearWordOrderCache,
  requestListRebuild
) {
  state.favoritesUpdatedAt = Date.now();
  state.favoritesVersion = (Number(state.favoritesVersion) || 0) + 1;
  saveFavoritesToLocalOnly(state.favorites);
  saveFavoritesUpdatedAt(state.favoritesUpdatedAt);
  clearWordOrderCache();
  requestListRebuild();
  return {
    favoritesUpdatedAt: state.favoritesUpdatedAt,
    favoritesVersion: state.favoritesVersion
  };
}

function toggleFavoriteRecord(favorites, key) {
  if (favorites[key]) {
    delete favorites[key];
  } else {
    favorites[key] = { addedAt: Date.now() };
  }
}

function saveCurrentFavoriteIndex(state, callbacks, currentId) {
  callbacks.applyWordOrder(false);

  const currentWords = callbacks.getWords();
  const nextIndex = currentWords.findIndex((item) => item.id === currentId);
  state.index = nextIndex >= 0 ? nextIndex : clampIndex(state.index, currentWords);

  if (currentWords.length > 0) {
    state.indexByVol.favorites = state.index;
    callbacks.saveIndexByVol(state.indexByVol);
  }
}

function finishFavoriteToggle(state, callbacks, updated) {
  callbacks.render();
  callbacks.updateFavoriteToggleButton();
  return createFavoritesResult(state, updated);
}

export function toggleFavoriteCurrentWord(state, callbacks) {
  const current = callbacks.getCurrentWord();
  if (!current) return null;

  const key = getFavoriteRecordKey(state.favorites, current);
  toggleFavoriteRecord(state.favorites, key);

  const updated = touchFavoritesChanged(
    state,
    callbacks.saveFavoritesToLocalOnly,
    callbacks.saveFavoritesUpdatedAt,
    callbacks.clearWordOrderCache,
    callbacks.requestListRebuild
  );

  callbacks.updateFavoriteToggleButton();

  if (state.currentUser) {
    callbacks.saveFavoritesToCloud();
  }

  if (state.currentMode === "favorites") {
    saveCurrentFavoriteIndex(state, callbacks, current.id);
  }

  return finishFavoriteToggle(state, callbacks, updated);
}

function hasFavoriteRecords(favorites) {
  return Object.keys(favorites || {}).length > 0;
}

function finishEmptyFavoritesMode(state, callbacks) {
  callbacks.applyWordOrder(true);
  state.index = 0;
  callbacks.requestListRebuild();
  callbacks.render();
  callbacks.updateFavoriteToggleButton();
  return createFavoritesResult(state);
}

function setFavoritesMode(state, callbacks) {
  callbacks.setCurrentMode("favorites");
  state.currentMode = "favorites";
  callbacks.saveCurrentModeState("favorites");
  callbacks.clearNavigationHistory();
}

function chooseFavoriteIndex(state, callbacks) {
  const currentWords = callbacks.getWords();
  const fallbackIndex = clampIndex(state.indexByVol.favorites || 0, currentWords);
  const current = callbacks.getCurrentWord ? callbacks.getCurrentWord() : null;

  if (!current || !isFavorite(state.favorites, current)) {
    state.index = fallbackIndex;
    return;
  }

  const favoriteIndex = currentWords.findIndex((item) => item.id === current.id);
  state.index = favoriteIndex >= 0 ? favoriteIndex : fallbackIndex;
}

export async function loadFavoritesMode(state, callbacks, volOrder) {
  setFavoritesMode(state, callbacks);

  if (!hasFavoriteRecords(state.favorites)) {
    return finishEmptyFavoritesMode(state, callbacks);
  }

  await callbacks.ensureAllVolumesLoaded();
  const favoriteEntries = buildFavoriteEntries(state.allWordsByVol, volOrder, state.favorites);

  if (favoriteEntries.length === 0) {
    return finishEmptyFavoritesMode(state, callbacks);
  }

  callbacks.applyWordOrder(false);
  chooseFavoriteIndex(state, callbacks);

  callbacks.requestListRebuild();
  callbacks.render();
  return createFavoritesResult(state);
}
