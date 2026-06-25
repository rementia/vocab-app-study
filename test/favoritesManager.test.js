import assert from "assert";
import {
  buildFavoriteEntries,
  isFavorite,
  loadFavoritesMode,
  migrateLegacyFavoriteRecords,
  toggleFavoriteCurrentWord
} from "../favoritesManager.js";

const wordsByVol = {
  vol1: [
    { id: "vol1-1-alpha", word: "alpha", sourceVol: "vol1" },
    { id: "vol1-2-beta", word: "beta", sourceVol: "vol1" }
  ],
  vol2: [
    { id: "vol2-1-gamma", word: "gamma", sourceVol: "vol2" }
  ]
};

const favorites = {
  beta: { addedAt: 1 },
  gamma: { addedAt: 2 }
};

assert.strictEqual(isFavorite(favorites, wordsByVol.vol1[1]), true);
assert.strictEqual(isFavorite(favorites, wordsByVol.vol1[0]), false);
assert.strictEqual(
  isFavorite(favorites, { id: "w_beta001", word: "beta", legacyWordKey: "beta" }),
  true,
  "legacy word-key favorites should remain readable when a stable id exists"
);

const legacyFavorites = { beta: { addedAt: 1 } };
assert.strictEqual(migrateLegacyFavoriteRecords(legacyFavorites, {
  vol1: [{ id: "w_beta001", word: "beta", legacyWordKey: "beta" }]
}).changed, true);
assert.strictEqual(Boolean(legacyFavorites.w_beta001), true);
assert.strictEqual(Boolean(legacyFavorites.beta), false);

const duplicateFavorites = {
  beta: { addedAt: 1 },
  w_beta001: { addedAt: 2 }
};
migrateLegacyFavoriteRecords(duplicateFavorites, {
  vol1: [{ id: "w_beta001", word: "beta", legacyWordKey: "beta" }]
});
assert.deepStrictEqual(duplicateFavorites, { w_beta001: { addedAt: 2 } });
assert.deepStrictEqual(
  buildFavoriteEntries(wordsByVol, ["vol1", "vol2"], favorites).map((item) => item.word),
  ["beta", "gamma"]
);

const state = {
  allWordsByVol: wordsByVol,
  currentMode: "vol",
  currentVol: "vol1",
  indexByVol: { favorites: 0 },
  favorites,
  words: [],
  randomMode: true,
  frequencyMode: true
};

let savedMode = null;
let applyCalls = 0;
let rendered = 0;
let listRebuilds = 0;
const callbacks = {
  ensureAllVolumesLoaded: async () => {},
  setCurrentMode: (mode) => { state.currentMode = mode; },
  saveCurrentModeState: (mode) => { savedMode = mode; },
  clearNavigationHistory: () => {},
  applyWordOrder: () => {
    applyCalls += 1;
    state.words = buildFavoriteEntries(state.allWordsByVol, ["vol1", "vol2"], state.favorites);
  },
  getWords: () => state.words,
  getCurrentWord: () => null,
  requestListRebuild: () => { listRebuilds += 1; },
  render: () => { rendered += 1; },
  updateFavoriteToggleButton: () => {},
  saveRandomModeState: () => { throw new Error("random mode should be preserved"); },
  saveFrequencyModeState: () => { throw new Error("frequency mode should be preserved"); },
  updateRandomButton: () => { throw new Error("random button should not be forced off"); },
  updateFrequencyButton: () => { throw new Error("frequency button should not be forced off"); },
  setRandomMode: () => { throw new Error("random mode should not be changed"); },
  setFrequencyMode: () => { throw new Error("frequency mode should not be changed"); }
};

const result = await loadFavoritesMode(state, callbacks, ["vol1", "vol2"]);
assert.strictEqual(savedMode, "favorites");
assert.strictEqual(result.randomMode, true);
assert.strictEqual(result.frequencyMode, true);
assert.strictEqual(state.randomMode, true);
assert.strictEqual(state.frequencyMode, true);
assert.strictEqual(applyCalls, 1);
assert.strictEqual(rendered, 1);
assert.strictEqual(listRebuilds, 1);


const emptyState = {
  allWordsByVol: {},
  currentMode: "vol",
  currentVol: "vol1",
  indexByVol: { favorites: 0 },
  favorites: {},
  words: [],
  randomMode: false,
  frequencyMode: false
};
let emptyRendered = 0;
let emptyListRebuilds = 0;
const emptyResult = await loadFavoritesMode(
  emptyState,
  {
    ensureAllVolumesLoaded: async () => { throw new Error("empty favorites should not load volumes"); },
    setCurrentMode: (mode) => { emptyState.currentMode = mode; },
    saveCurrentModeState: () => {},
    clearNavigationHistory: () => {},
    applyWordOrder: () => { emptyState.words = []; },
    getWords: () => emptyState.words,
    getCurrentWord: () => null,
    requestListRebuild: () => { emptyListRebuilds += 1; },
    render: () => { emptyRendered += 1; },
    updateFavoriteToggleButton: () => {}
  },
  ["vol1", "vol2"]
);
assert.strictEqual(emptyResult.currentMode, "favorites");
assert.strictEqual(emptyResult.index, 0);
assert.strictEqual(emptyRendered, 1);
assert.strictEqual(emptyListRebuilds, 1);

const toggleState = {
  favorites: { beta: { addedAt: 1 } },
  favoritesUpdatedAt: 0,
  favoritesVersion: 0,
  currentMode: "favorites",
  currentUser: { uid: "user-1" },
  words: [wordsByVol.vol1[1]],
  index: 0,
  indexByVol: { favorites: 0 }
};
let toggleListRebuilds = 0;
let toggleRendered = 0;
const toggleResult = toggleFavoriteCurrentWord(toggleState, {
  getCurrentWord: () => wordsByVol.vol1[1],
  getWords: () => toggleState.words,
  saveFavoritesToLocalOnly: () => {},
  saveFavoritesUpdatedAt: () => {},
  clearWordOrderCache: () => {},
  requestListRebuild: () => { toggleListRebuilds += 1; },
  updateFavoriteToggleButton: () => {},
  saveFavoritesToCloud: () => {},
  applyWordOrder: () => { toggleState.words = buildFavoriteEntries(wordsByVol, ["vol1"], toggleState.favorites); },
  saveIndexByVol: () => {},
  render: () => { toggleRendered += 1; }
});
assert.strictEqual(Boolean(toggleState.favorites.beta), false);
assert.strictEqual(toggleResult.index, 0);
assert.strictEqual(toggleListRebuilds, 1, "favorite toggle should request one list rebuild");
assert.strictEqual(toggleRendered, 1);
console.log("All favorite word tests passed.");
