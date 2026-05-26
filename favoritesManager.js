export function makeFavoriteKey(item) {
  return item.id;
}

export function isFavorite(favorites, item) {
  return !!favorites[makeFavoriteKey(item)];
}

export function buildFavoriteEntries(allWordsByVol, volOrder, favorites) {
  const entries = [];

  volOrder.forEach((vol) => {
    (allWordsByVol[vol] || []).forEach((item) => {
      if (isFavorite(favorites, item)) {
        entries.push(item);
      }
    });
  });

  return entries;
}

export function touchFavoritesChanged(
  state,
  saveFavoritesToLocalOnly,
  saveFavoritesUpdatedAt,
  clearAllShuffleCache,
  requestListRebuild
) {
  state.favoritesUpdatedAt = Date.now();
  state.favoritesVersion = (Number(state.favoritesVersion) || 0) + 1;
  saveFavoritesToLocalOnly(state.favorites);
  saveFavoritesUpdatedAt(state.favoritesUpdatedAt);
  clearAllShuffleCache();
  requestListRebuild();
  return {
    favoritesUpdatedAt: state.favoritesUpdatedAt,
    favoritesVersion: state.favoritesVersion
  };
}

export function toggleFavoriteCurrentWord(state, callbacks) {
  const current = callbacks.getCurrentWord();
  if (!current) return null;

  const key = makeFavoriteKey(current);

  if (state.favorites[key]) {
    delete state.favorites[key];
  } else {
    state.favorites[key] = { addedAt: Date.now() };
  }

  const updated = touchFavoritesChanged(
    state,
    callbacks.saveFavoritesToLocalOnly,
    callbacks.saveFavoritesUpdatedAt,
    callbacks.clearAllShuffleCache,
    callbacks.requestListRebuild
  );

  callbacks.updateFavoriteToggleButton();

  if (state.currentUser) {
    callbacks.saveFavoritesToCloud();
  }

  if (state.currentMode === "favorites") {
    const currentId = current.id;
    callbacks.applyWordOrder(false);

    const currentWords = callbacks.getWords();
    const nextIndex = currentWords.findIndex((item) => item.id === currentId);
    state.index = nextIndex >= 0 ? nextIndex : Math.min(state.index, Math.max(currentWords.length - 1, 0));

    if (currentWords.length === 0) {
      state.index = 0;
      callbacks.requestListRebuild();
      callbacks.render();
      callbacks.updateFavoriteToggleButton();
      return {
        ...updated,
        index: state.index,
        indexByVol: state.indexByVol
      };
    }

    state.indexByVol.favorites = state.index;
    callbacks.saveIndexByVol(state.indexByVol);
    callbacks.requestListRebuild();
  }

  callbacks.render();
  callbacks.updateFavoriteToggleButton();
  return {
    ...updated,
    index: state.index,
    indexByVol: state.indexByVol
  };
}

export async function loadFavoritesMode(state, callbacks, volOrder) {
  callbacks.setCurrentMode("favorites");
  state.currentMode = "favorites";
  callbacks.saveCurrentModeState("favorites");
  callbacks.clearNavigationHistory();

  const hasFavorites = Object.keys(state.favorites || {}).length > 0;
  if (!hasFavorites) {
    callbacks.applyWordOrder(true);
    state.index = 0;
    callbacks.requestListRebuild();
    callbacks.render();
    callbacks.updateFavoriteToggleButton();
    return {
      currentMode: state.currentMode,
      index: state.index,
      randomMode: state.randomMode,
      frequencyMode: state.frequencyMode
    };
  }

  await callbacks.ensureAllVolumesLoaded();
  const favoriteEntries = buildFavoriteEntries(state.allWordsByVol, volOrder, state.favorites);

  if (favoriteEntries.length === 0) {
    callbacks.applyWordOrder(true);
    state.index = 0;
    callbacks.requestListRebuild();
    callbacks.render();
    callbacks.updateFavoriteToggleButton();
    return {
      currentMode: state.currentMode,
      index: state.index,
      randomMode: state.randomMode,
      frequencyMode: state.frequencyMode
    };
  }

  callbacks.applyWordOrder(false);
  const currentWords = callbacks.getWords();

  const current = callbacks.getCurrentWord ? callbacks.getCurrentWord() : null;
  if (current && state.favorites[makeFavoriteKey(current)]) {
    const favoriteIndex = currentWords.findIndex((item) => item.id === current.id);
    if (favoriteIndex >= 0) {
      state.index = favoriteIndex;
    } else {
      state.index = Math.min(state.indexByVol.favorites || 0, Math.max(currentWords.length - 1, 0));
    }
  } else {
    state.index = Math.min(state.indexByVol.favorites || 0, Math.max(currentWords.length - 1, 0));
  }

  callbacks.requestListRebuild();
  callbacks.render();
  return {
    currentMode: state.currentMode,
    index: state.index,
    randomMode: state.randomMode,
    frequencyMode: state.frequencyMode
  };
}
