import { makeWordKey } from "./wordIdentity.js";
import { buildMarkedWordEntries, clampIndex } from "./wordList.js";

function makeDifficultKey(item) {
  return makeWordKey(item);
}

export function isDifficult(difficults, item) {
  return !!difficults[makeDifficultKey(item)];
}

export function buildDifficultEntries(allWordsByVol, volOrder, difficults) {
  return buildMarkedWordEntries(allWordsByVol, volOrder, difficults, isDifficult);
}

function createDifficultsResult(state, updated = {}) {
  return {
    ...updated,
    currentMode: state.currentMode,
    index: state.index,
    indexByVol: state.indexByVol,
    randomMode: state.randomMode,
    frequencyMode: state.frequencyMode
  };
}

function touchDifficultsChanged(
  state,
  saveDifficultsToLocalOnly,
  saveDifficultsUpdatedAt,
  clearWordOrderCache,
  requestListRebuild
) {
  state.difficultsUpdatedAt = Date.now();
  state.difficultsVersion = (Number(state.difficultsVersion) || 0) + 1;
  saveDifficultsToLocalOnly(state.difficults);
  saveDifficultsUpdatedAt(state.difficultsUpdatedAt);
  clearWordOrderCache();
  requestListRebuild();
  return {
    difficultsUpdatedAt: state.difficultsUpdatedAt,
    difficultsVersion: state.difficultsVersion
  };
}

function toggleDifficultRecord(difficults, key) {
  if (difficults[key]) {
    delete difficults[key];
  } else {
    difficults[key] = { addedAt: Date.now() };
  }
}

function saveCurrentDifficultIndex(state, callbacks, currentId) {
  callbacks.applyWordOrder(false);

  const currentWords = callbacks.getWords();
  const nextIndex = currentWords.findIndex((item) => item.id === currentId);
  state.index = nextIndex >= 0 ? nextIndex : clampIndex(state.index, currentWords);

  if (currentWords.length > 0) {
    state.indexByVol.difficults = state.index;
    callbacks.saveIndexByVol(state.indexByVol);
  }
}

function finishDifficultToggle(state, callbacks, updated) {
  callbacks.render();
  callbacks.updateDifficultToggleButton();
  return createDifficultsResult(state, updated);
}

export function toggleDifficultCurrentWord(state, callbacks) {
  const current = callbacks.getCurrentWord();
  if (!current) return null;

  const key = makeDifficultKey(current);
  toggleDifficultRecord(state.difficults, key);

  const updated = touchDifficultsChanged(
    state,
    callbacks.saveDifficultsToLocalOnly,
    callbacks.saveDifficultsUpdatedAt,
    callbacks.clearWordOrderCache,
    callbacks.requestListRebuild
  );

  callbacks.updateDifficultToggleButton();

  if (state.currentUser) {
    callbacks.saveDifficultsToCloud();
  }

  if (state.currentMode === "difficults") {
    saveCurrentDifficultIndex(state, callbacks, current.id);
  }

  return finishDifficultToggle(state, callbacks, updated);
}

function setDifficultsMode(state, callbacks) {
  callbacks.setCurrentMode("difficults");
  state.currentMode = "difficults";
  callbacks.saveCurrentModeState("difficults");
  callbacks.clearNavigationHistory();
}

function hasDifficultRecords(difficults) {
  return Object.keys(difficults || {}).length > 0;
}

function finishEmptyDifficultsMode(state, callbacks) {
  callbacks.applyWordOrder(true);
  state.index = 0;
  callbacks.requestListRebuild();
  callbacks.render();
  callbacks.updateDifficultToggleButton();
  return createDifficultsResult(state);
}

function chooseDifficultIndex(state, callbacks) {
  const currentWords = callbacks.getWords();
  state.index = clampIndex(state.indexByVol.difficults || 0, currentWords);
}

export async function loadDifficultsMode(state, callbacks, volOrder) {
  setDifficultsMode(state, callbacks);

  if (!hasDifficultRecords(state.difficults)) {
    return finishEmptyDifficultsMode(state, callbacks);
  }

  await callbacks.ensureAllVolumesLoaded();

  callbacks.applyWordOrder(false);
  chooseDifficultIndex(state, callbacks);

  callbacks.requestListRebuild();
  callbacks.render();
  callbacks.updateDifficultToggleButton();
  return createDifficultsResult(state);
}
