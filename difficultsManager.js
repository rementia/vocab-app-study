export function makeDifficultKey(item) {
  return item.id;
}

export function isDifficult(difficults, item) {
  return !!difficults[makeDifficultKey(item)];
}

export function buildDifficultEntries(allWordsByVol, volOrder, difficults) {
  const entries = [];

  volOrder.forEach((vol) => {
    (allWordsByVol[vol] || []).forEach((item) => {
      if (isDifficult(difficults, item)) {
        entries.push(item);
      }
    });
  });

  return entries;
}

export function toggleDifficultCurrentWord(state, callbacks) {
  const current = callbacks.getCurrentWord();
  if (!current) return null;

  const key = makeDifficultKey(current);

  if (state.difficults[key]) {
    delete state.difficults[key];
  } else {
    state.difficults[key] = { addedAt: Date.now() };
  }

  state.difficultsUpdatedAt = Date.now();
  state.difficultsVersion = (Number(state.difficultsVersion) || 0) + 1;
  callbacks.saveDifficultsToLocalOnly(state.difficults);
  callbacks.saveDifficultsUpdatedAt(state.difficultsUpdatedAt);
  callbacks.clearAllShuffleCache();
  callbacks.requestListRebuild();
  callbacks.updateDifficultToggleButton();

  if (state.currentUser) {
    callbacks.saveDifficultsToCloud();
  }

  if (state.currentMode === "difficults") {
    const currentId = current.id;
    callbacks.applyWordOrder(false);
    const currentWords = callbacks.getWords();
    const nextIndex = currentWords.findIndex((item) => item.id === currentId);
    state.index = nextIndex >= 0 ? nextIndex : Math.min(state.index, Math.max(currentWords.length - 1, 0));

    if (currentWords.length === 0) {
      state.index = 0;
      callbacks.render();
      callbacks.updateDifficultToggleButton();
      return {
        index: state.index,
        indexByVol: state.indexByVol,
        difficultsUpdatedAt: state.difficultsUpdatedAt,
        difficultsVersion: state.difficultsVersion
      };
    }

    state.indexByVol.difficults = state.index;
    callbacks.saveIndexByVol(state.indexByVol);
  }

  callbacks.render();
  callbacks.updateDifficultToggleButton();
  return {
    index: state.index,
    indexByVol: state.indexByVol,
    difficultsUpdatedAt: state.difficultsUpdatedAt,
    difficultsVersion: state.difficultsVersion
  };
}

export async function loadDifficultsMode(state, callbacks, volOrder) {
  await callbacks.ensureAllVolumesLoaded();

  callbacks.setCurrentMode("difficults");
  state.currentMode = "difficults";
  callbacks.saveCurrentModeState("difficults");


  callbacks.clearNavigationHistory();
  callbacks.applyWordOrder(false);
  const currentWords = callbacks.getWords();
  state.index = Math.min(state.indexByVol.difficults || 0, Math.max(currentWords.length - 1, 0));

  if (currentWords.length === 0) {
    state.index = 0;
  }

  callbacks.requestListRebuild();
  callbacks.render();
  callbacks.updateDifficultToggleButton();
  return {
    currentMode: state.currentMode,
    index: state.index,
    randomMode: state.randomMode,
    frequencyMode: state.frequencyMode
  };
}
