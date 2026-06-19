import assert from "node:assert/strict";
import { readSavedAppState } from "../savedState.js";

function makeReader(values) {
  return (key) => values[key] ?? null;
}

const keys = {
  vol: "vol",
  mode: "mode",
  indexByVol: "indexByVol",
  sidebarOpen: "sidebarOpen",
  speechSync: "speechSync",
  favorites: "favorites",
  favoritesUpdatedAt: "favoritesUpdatedAt",
  difficults: "difficults",
  difficultsUpdatedAt: "difficultsUpdatedAt",
  reviewScores: "reviewScores",
  challengeMode: "challengeMode",
  challengeTime: "challengeTime",
  displayTime: "displayTime",
  translationMode: "translationMode",
  multipleChoiceMode: "multipleChoiceMode",
  autoPlay: "autoPlay",
  randomMode: "randomMode",
  frequencyMode: "frequencyMode"
};

const defaults = {
  currentVol: "vol1",
  currentMode: "vol",
  sidebarOpen: false,
  speechSync: false,
  indexByVol: { vol1: 0, favorites: 0, difficults: 0 },
  favoritesUpdatedAt: 0,
  difficultsUpdatedAt: 0,
  challengeMode: false,
  challengeTime: 1500,
  displayTime: 1500,
  translationMode: false,
  multipleChoiceMode: false,
  randomMode: false,
  frequencyMode: false
};

{
  const state = readSavedAppState({
    storageKeys: keys,
    safeGetItem: makeReader({
      vol: "vol2",
      mode: "favorites",
      indexByVol: "{\"vol2\":3}",
      sidebarOpen: "true",
      speechSync: "true",
      favorites: "{\"Hello\":{\"addedAt\":1}}",
      difficults: "{\"vol1-0-Hard\":{\"addedAt\":2}}",
      reviewScores: "{\"Word\":{\"score\":4}}",
      favoritesUpdatedAt: "100",
      difficultsUpdatedAt: "200",
      challengeMode: "true",
      challengeTime: "99999",
      displayTime: "500",
      translationMode: "true",
      multipleChoiceMode: "true",
      autoPlay: "once",
      randomMode: "true",
      frequencyMode: "true"
    }),
    availableVolumes: { vol1: true, vol2: true },
    defaults,
    getDefaultSidebarOpen: () => false,
    recallTimeRange: { min: 1000, max: 5000 }
  });

  assert.equal(state.currentVol, "vol2");
  assert.equal(state.currentMode, "favorites");
  assert.deepEqual(state.indexByVol, { vol1: 0, favorites: 0, difficults: 0, vol2: 3 });
  assert.equal(state.sidebarOpen, true);
  assert.equal(state.speechSync, true);
  assert.deepEqual(state.favorites, { hello: { addedAt: 1 } });
  assert.deepEqual(state.difficults, { hard: { addedAt: 2 } });
  assert.deepEqual(state.reviewScores, { word: { score: 4 } });
  assert.equal(state.favoritesUpdatedAt, 100);
  assert.equal(state.difficultsUpdatedAt, 200);
  assert.equal(state.challengeMode, true);
  assert.equal(state.challengeTime, 5000);
  assert.equal(state.displayTime, 1000);
  assert.equal(state.translationMode, true);
  assert.equal(state.multipleChoiceMode, true);
  assert.equal(state.shouldResetAutoPlay, true);
  assert.equal(state.randomMode, true);
  assert.equal(state.frequencyMode, true);
}

{
  const state = readSavedAppState({
    storageKeys: keys,
    safeGetItem: makeReader({
      vol: "missing",
      mode: "invalid",
      indexByVol: "not json",
      sidebarOpen: null
    }),
    availableVolumes: { vol1: true },
    defaults,
    getDefaultSidebarOpen: () => true,
    recallTimeRange: { min: 1000, max: 5000 }
  });

  assert.equal(state.currentVol, "vol1");
  assert.equal(state.currentMode, "vol");
  assert.deepEqual(state.indexByVol, defaults.indexByVol);
  assert.equal(state.sidebarOpen, true);
  assert.equal(state.multipleChoiceMode, false);
  assert.equal(state.shouldResetAutoPlay, false);
}

console.log("All saved state tests passed.");
