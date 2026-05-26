import assert from "assert";
import {
  buildFavoriteEntries,
  isFavorite,
  loadFavoritesMode
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
  "vol1-2-beta": { addedAt: 1 },
  "vol2-1-gamma": { addedAt: 2 }
};

assert.strictEqual(isFavorite(favorites, wordsByVol.vol1[1]), true);
assert.strictEqual(isFavorite(favorites, wordsByVol.vol1[0]), false);
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
console.log("All favorite word tests passed.");