import assert from "assert";
import {
  buildDifficultEntries,
  isDifficult,
  loadDifficultsMode,
  toggleDifficultCurrentWord
} from "../difficultsManager.js";

const wordsByVol = {
  vol1: [
    { id: "vol1-1-alpha", word: "alpha", sourceVol: "vol1" },
    { id: "vol1-2-beta", word: "beta", sourceVol: "vol1" }
  ],
  vol2: [
    { id: "vol2-1-gamma", word: "gamma", sourceVol: "vol2" }
  ]
};

const difficults = {
  beta: { addedAt: 1 },
  gamma: { addedAt: 2 }
};

assert.strictEqual(isDifficult(difficults, wordsByVol.vol1[1]), true);
assert.strictEqual(isDifficult(difficults, wordsByVol.vol1[0]), false);
assert.deepStrictEqual(
  buildDifficultEntries(wordsByVol, ["vol1", "vol2"], difficults).map((item) => item.word),
  ["beta", "gamma"]
);

let savedDifficults = null;
let savedDifficultsUpdatedAt = null;
let cloudSaveCalls = 0;
let rendered = 0;
const state = {
  difficults: {},
  difficultsUpdatedAt: 0,
  difficultsVersion: 0,
  currentMode: "vol",
  currentUser: { uid: "user-1" },
  words: wordsByVol.vol1,
  index: 0,
  indexByVol: { vol1: 0, difficults: 0 }
};

const callbacks = {
  getCurrentWord: () => state.words[state.index],
  getWords: () => state.words,
  saveDifficultsToLocalOnly: (value) => { savedDifficults = { ...value }; },
  saveDifficultsUpdatedAt: (value) => { savedDifficultsUpdatedAt = value; },
  saveDifficultsToCloud: () => { cloudSaveCalls += 1; },
  clearWordOrderCache: () => {},
  requestListRebuild: () => {},
  updateDifficultToggleButton: () => {},
  applyWordOrder: () => {},
  saveIndexByVol: () => {},
  render: () => { rendered += 1; }
};

const result = toggleDifficultCurrentWord(state, callbacks);
assert.strictEqual(Boolean(savedDifficults["vol1-1-alpha"]), true);
assert.strictEqual(result.difficultsVersion, 1);
assert.strictEqual(typeof result.difficultsUpdatedAt, "number");
assert.strictEqual(savedDifficultsUpdatedAt, result.difficultsUpdatedAt);
assert.strictEqual(cloudSaveCalls, 1);
assert.strictEqual(rendered, 1);

const modeState = {
  allWordsByVol: wordsByVol,
  currentMode: "vol",
  indexByVol: { difficults: 0 },
  difficults,
  words: [],
  randomMode: true,
  frequencyMode: true
};
let savedMode = null;
let modeApplyCalls = 0;
let modeRendered = 0;
let modeListRebuilds = 0;
const modeCallbacks = {
  ensureAllVolumesLoaded: async () => {},
  setCurrentMode: (mode) => { modeState.currentMode = mode; },
  saveCurrentModeState: (mode) => { savedMode = mode; },
  clearNavigationHistory: () => {},
  applyWordOrder: () => {
    modeApplyCalls += 1;
    modeState.words = buildDifficultEntries(modeState.allWordsByVol, ["vol1", "vol2"], modeState.difficults);
  },
  getWords: () => modeState.words,
  requestListRebuild: () => { modeListRebuilds += 1; },
  render: () => { modeRendered += 1; },
  updateDifficultToggleButton: () => {},
  saveRandomModeState: () => { throw new Error("random mode should be preserved"); },
  saveFrequencyModeState: () => { throw new Error("frequency mode should be preserved"); },
  updateRandomButton: () => { throw new Error("random button should not be forced off"); },
  updateFrequencyButton: () => { throw new Error("frequency button should not be forced off"); },
  setRandomMode: () => { throw new Error("random mode should not be changed"); },
  setFrequencyMode: () => { throw new Error("frequency mode should not be changed"); }
};

const modeResult = await loadDifficultsMode(modeState, modeCallbacks, ["vol1", "vol2"]);
assert.strictEqual(savedMode, "difficults");
assert.strictEqual(modeResult.randomMode, true);
assert.strictEqual(modeResult.frequencyMode, true);
assert.strictEqual(modeState.randomMode, true);
assert.strictEqual(modeState.frequencyMode, true);
assert.strictEqual(modeApplyCalls, 1);
assert.strictEqual(modeRendered, 1);
assert.strictEqual(modeListRebuilds, 1);

const emptyModeState = {
  allWordsByVol: {},
  currentMode: "vol",
  indexByVol: { difficults: 0 },
  difficults: {},
  words: [],
  randomMode: false,
  frequencyMode: false
};
let emptyModeRendered = 0;
let emptyModeListRebuilds = 0;
const emptyModeResult = await loadDifficultsMode(
  emptyModeState,
  {
    ensureAllVolumesLoaded: async () => { throw new Error("empty difficults should not load volumes"); },
    setCurrentMode: (mode) => { emptyModeState.currentMode = mode; },
    saveCurrentModeState: () => {},
    clearNavigationHistory: () => {},
    applyWordOrder: () => { emptyModeState.words = []; },
    getWords: () => emptyModeState.words,
    requestListRebuild: () => { emptyModeListRebuilds += 1; },
    render: () => { emptyModeRendered += 1; },
    updateDifficultToggleButton: () => {}
  },
  ["vol1", "vol2"]
);
assert.strictEqual(emptyModeResult.currentMode, "difficults");
assert.strictEqual(emptyModeResult.index, 0);
assert.strictEqual(emptyModeRendered, 1);
assert.strictEqual(emptyModeListRebuilds, 1);

console.log("All difficult word tests passed.");
