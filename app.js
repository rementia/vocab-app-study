import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { availableVolumes, fetchWordsForVol } from './data.js';
import { getDomElements } from './dom.js';
import { auth, db, provider } from './firebaseClient.js';
import {
  FAVORITES_COLLECTION,
  volOrder,
  createInitialIndexByVol,
  createInitialWordsByVol
} from './state.js';
import { signInWithGoogle, signOutUser } from './auth.js';
import {
  STORAGE_KEYS,
  safeGetItem,
  saveCurrentVol,
  saveCurrentModeState,
  saveIndexByVol,
  saveSidebarState,
  saveSpeechSyncState,
  saveFavoritesToLocalOnly,
  saveFavoritesUpdatedAt,
  saveDifficultsToLocalOnly,
  saveDifficultsUpdatedAt,
  saveReviewScoresToLocalOnly,
  saveChallengeModeState,
  saveChallengeTimeState,
  saveDisplayTimeState,
  saveTranslationModeState,
  saveAutoPlayState,
  saveRandomModeState,
  saveFrequencyModeState
} from './storage.js';
import {
  renderApp,
  renderCurrentWord as renderCurrentWordUI,
  updateSpeechSyncButton as uiUpdateSpeechSyncButton,
  updateChallengeButton as uiUpdateChallengeButton,
  updateRecallTimeControl as uiUpdateRecallTimeControl,
  updateTranslationButton as uiUpdateTranslationButton,
  updateAutoPlayButton as uiUpdateAutoPlayButton,
  updateRandomButton as uiUpdateRandomButton,
  updateFrequencyButton as uiUpdateFrequencyButton,
  updateFavoriteToggleButton as uiUpdateFavoriteToggleButton,
  updateDifficultToggleButton as uiUpdateDifficultToggleButton,
  updateReviewButtons as uiUpdateReviewButtons,
  applySidebarState as uiApplySidebarState,
  updateAuthUI as uiUpdateAuthUI
} from './ui.js';
import {
  buildFavoriteEntries,
  isFavorite,
  toggleFavoriteCurrentWord as toggleFavoriteCurrentWordManager,
  loadFavoritesMode as loadFavoritesModeManager
} from './favoritesManager.js';
import {
  buildDifficultEntries,
  isDifficult,
  toggleDifficultCurrentWord as toggleDifficultCurrentWordManager,
  loadDifficultsMode as loadDifficultsModeManager
} from './difficultsManager.js';
import {
  getReviewScore,
  updateReviewScore,
  resetReviewScore,
  sortByReviewScore
} from './reviewManager.js';
import {
  bindKeyboardEvents,
  bindTouchEvents,
  isSwipeAllowedTarget,
  handleViewportChange
} from './events.js';
import {
  initNavigation,
  moveToIndex as navMoveToIndex,
  getRandomPrevIndexFromHistory as navGetRandomPrevIndexFromHistory,
  getRandomNextIndexFromHistory as navGetRandomNextIndexFromHistory,
  clearNavigationHistory as navClearNavigationHistory,
  getHistoryBackStack,
  getHistoryForwardStack
} from './navigation.js';
import {
  initPronunciation,
  updateSpeechButtonAvailability,
  speakWord,
  loadPronunciation
} from './pronunciation.js';
import {
  loadFavoritesFromCloudRemote,
  subscribeFavoritesRealtimeRemote,
  saveFavoritesToCloudRemote,
  saveDifficultsToCloudRemote,
  syncFavoritesWithCloud,
  syncDifficultsWithCloud,
  resolveFavoritesSnapshot,
  resolveDifficultsSnapshot
} from './favorites.js';
const {
  searchInputEl,
  listEl,
  sidebarEl,
  wordEl,
  meaningEl,
  progressEl,
  pronunciationEl,
  prevHintEl,
  nextHintEl,
  currentEl,
  recallTimeControlEl,
  displayTimeControlEl,
  timeSlider,
  timeValue,
  displayTimeSlider,
  displayTimeValue,
  favoriteToggleBtnEl,
  difficultToggleBtnEl,
  reviewScoreLabelEl,
  decreaseReviewBtnEl,
  resetReviewBtnEl,
  increaseReviewBtnEl,
  favoriteListBtnEl,
  difficultListBtnEl,
  speechSyncBtnEl,
  challengeBtnEl,
  translationBtnEl,
  autoPlayBtnEl,
  randomBtnEl,
  frequencyBtnEl,
  loginBtnEl,
  logoutBtnEl,
  toggleSidebarBtnEl,
  prevWordBtnEl,
  nextWordBtnEl,
  speakWordBtnEl,
  volButtons
} = getDomElements();

let currentUser = null;
let favoritesUnsubscribe = null;

let allWordsByVol = createInitialWordsByVol();

let words = [];
let index = 0;
let currentVol = "vol1";
let currentMode = "vol";
let sidebarOpen = true;
let speechSync = false;
let favorites = {};
let difficults = {};
let reviewScores = {};
let favoritesUpdatedAt = 0;
let difficultsUpdatedAt = 0;
let challengeMode = false;
let challengeTime = 1500;
let displayTime = 1500;
let translationMode = false;
let autoPlayMode = "off";
let autoPlayOnceStartPoint = null;
let randomMode = false;
let frequencyMode = false;

let meaningRevealTimer = null;
let speechSyncTimer = null;
let autoPlayTimer = null;
let autoPlayDisplayPhaseTimer = null;
let autoPlayWaitStartedAt = 0;
let wordOrderUpdatePending = false;
let hasFinishedInitialLoading = false;

let listNeedsRebuild = true;
let renderedListVersion = "";
let listVersion = 0;
let favoritesVersion = 0;
let difficultsVersion = 0;
let reviewScoresVersion = 0;
let searchQuery = "";

let indexByVol = createInitialIndexByVol();

const uiContext = {
  getState: () => ({
    words,
    currentMode,
    currentVol,
    randomMode,
    frequencyMode,
    listNeedsRebuild,
    renderedListVersion,
    listVersion,
    favoritesVersion,
    difficultsVersion,
    reviewScoresVersion,
    searchQuery,
    index,
    challengeMode,
    challengeTime,
    displayTime,
    translationMode,
    autoPlayMode,
    historyBackStack: getHistoryBackStack(),
    historyForwardStack: getHistoryForwardStack(),
    sidebarOpen,
    speechSync,
    currentUser
  }),
  dom: {
    searchInputEl,
    listEl,
    sidebarEl,
    wordEl,
    meaningEl,
    progressEl,
    pronunciationEl,
    prevHintEl,
    nextHintEl,
    currentEl,
    recallTimeControlEl,
    displayTimeControlEl,
    displayTimeSlider,
    displayTimeValue,
    favoriteToggleBtnEl,
    difficultToggleBtnEl,
    reviewScoreLabelEl,
    decreaseReviewBtnEl,
    resetReviewBtnEl,
    increaseReviewBtnEl,
    favoriteListBtnEl,
    difficultListBtnEl,
    speechSyncBtnEl,
    challengeBtnEl,
    translationBtnEl,
    autoPlayBtnEl,
    randomBtnEl,
    frequencyBtnEl,
    loginBtnEl,
    logoutBtnEl,
    toggleSidebarBtnEl,
    volButtons
  },
  callbacks: {
    isFavorite: (item) => isFavorite(favorites, item),
    isDifficult: (item) => isDifficult(difficults, item),
    getReviewScore: (item) => getReviewScore(reviewScores, item),
    getCurrentWord,
    persistCurrentIndex,
    loadPronunciation,
    clearMeaningRevealTimer,
    clearSpeechSyncTimer,
    setMeaningRevealTimer,
    setListNeedsRebuild,
    setRenderedListVersion,
    setSearchQuery
  }
};

const AUTO_PLAY_SKIP_LOCK_MS = 500;

let shuffledWordsMap = {};

async function init() {
  loadSavedState();
  initNavigation({
    getIndex: () => index,
    setIndex: (n) => { index = n; },
    renderCurrentWord,
    scheduleSpeechSync,
    getWordsLength: () => words.length
  });
  bindTouchEvents({ prevWord, nextWord, isSwipeAllowedTarget });
  bindUIEvents();
  bindKeyboardEvents({
    prevWord,
    nextWord,
    speakWord: handleSpeakCurrentWord,
    handleToggleFavoriteCurrentWord,
    handleToggleDifficultCurrentWord,
    decreaseReviewScore: () => handleReviewCurrentWord(-1, decreaseReviewBtnEl),
    resetReviewScore: handleResetReviewCurrentWord,
    increaseReviewScore: () => handleReviewCurrentWord(1, increaseReviewBtnEl),
    focusSearch,
    clearSearch,
    selectNextSearchResult,
    selectPreviousSearchResult,
    closeSidebar,
    toggleSidebar,
    toggleRandomMode
  });
  setupAuthListener();
  initPronunciation({ el: pronunciationEl, getCurrentWord });
  updateSpeechButtonAvailability(speakWordBtnEl);

  window.addEventListener("resize", handleViewportResize);
  window.addEventListener("orientationchange", handleViewportResize);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleViewportResize);
  }

  handleViewportResize();

  setAppLocked(true, "Googleログインしてください");
  finishInitialLoading();
}

const handleViewportResize = handleViewportChange(renderLayout);

async function handleLoadFavoritesMode() {
  if (currentMode !== "favorites" && isAutoPlayActive()) {
    stopAutoPlay();
  }
  const result = await loadFavoritesModeManager(
    { allWordsByVol, currentMode, currentVol, indexByVol, favorites, words, randomMode, frequencyMode },
    {
      ensureAllVolumesLoaded,
      saveCurrentModeState,
      saveRandomModeState,
      saveFrequencyModeState,
      clearNavigationHistory: navClearNavigationHistory,
      applyWordOrder,
      requestListRebuild,
      render,
      updateRandomButton,
      updateFrequencyButton,
      updateFavoriteToggleButton,
      getWords: () => words,
      getCurrentWord,
      setCurrentMode: (mode) => { currentMode = mode; },
      setRandomMode: (value) => { randomMode = value; },
      setFrequencyMode: (value) => { frequencyMode = value; }
    },
    volOrder
  );

  if (result) {
    currentMode = result.currentMode;
    index = result.index;
    if (typeof result.randomMode === "boolean") {
      randomMode = result.randomMode;
    }
    if (typeof result.frequencyMode === "boolean") {
      frequencyMode = result.frequencyMode;
    }
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();
  }
}


async function handleLoadDifficultsMode() {
  if (currentMode !== "difficults" && isAutoPlayActive()) {
    stopAutoPlay();
  }
  const result = await loadDifficultsModeManager(
    { allWordsByVol, currentMode, indexByVol, difficults, words, randomMode, frequencyMode },
    {
      ensureAllVolumesLoaded,
      saveCurrentModeState,
      saveRandomModeState,
      saveFrequencyModeState,
      clearNavigationHistory: navClearNavigationHistory,
      applyWordOrder,
      requestListRebuild,
      render,
      updateRandomButton,
      updateFrequencyButton,
      updateDifficultToggleButton,
      getWords: () => words,
      setCurrentMode: (mode) => { currentMode = mode; },
      setRandomMode: (value) => { randomMode = value; },
      setFrequencyMode: (value) => { frequencyMode = value; }
    },
    volOrder
  );

  if (result) {
    currentMode = result.currentMode;
    index = result.index;
    if (typeof result.randomMode === "boolean") {
      randomMode = result.randomMode;
    }
    if (typeof result.frequencyMode === "boolean") {
      frequencyMode = result.frequencyMode;
    }
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();
  }
}
function handleToggleFavoriteCurrentWord() {
  if (!currentUser) {
    updateFavoriteToggleButton();
    return;
  }

  const result = toggleFavoriteCurrentWordManager(
    {
      favorites,
      favoritesUpdatedAt,
      favoritesVersion,
      currentMode,
      currentUser,
      words,
      index,
      indexByVol
    },
    {
      getCurrentWord,
      getWords: () => words,
      saveFavoritesToLocalOnly,
      saveFavoritesUpdatedAt,
      clearAllShuffleCache,
      requestListRebuild,
      updateFavoriteToggleButton,
      saveFavoritesToCloud,
      applyWordOrder,
      saveIndexByVol,
      render
    }
  );

  if (result) {
    if (typeof result.index === "number") index = result.index;
    if (result.currentMode) currentMode = result.currentMode;
    if (result.indexByVol) indexByVol = result.indexByVol;
    if (typeof result.favoritesUpdatedAt === "number") favoritesUpdatedAt = result.favoritesUpdatedAt;
    if (typeof result.favoritesVersion === "number") favoritesVersion = result.favoritesVersion;
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();
  }
}


function handleToggleDifficultCurrentWord() {
  if (!currentUser) {
    updateDifficultToggleButton();
    return;
  }

  const result = toggleDifficultCurrentWordManager(
    {
      difficults,
      difficultsUpdatedAt,
      difficultsVersion,
      currentMode,
      currentUser,
      words,
      index,
      indexByVol
    },
    {
      getCurrentWord,
      getWords: () => words,
      saveDifficultsToLocalOnly,
      saveDifficultsUpdatedAt,
      clearAllShuffleCache,
      requestListRebuild,
      updateDifficultToggleButton,
      saveDifficultsToCloud,
      applyWordOrder,
      saveIndexByVol,
      render
    }
  );

  if (result) {
    if (typeof result.index === "number") index = result.index;
    if (result.indexByVol) indexByVol = result.indexByVol;
    if (typeof result.difficultsUpdatedAt === "number") difficultsUpdatedAt = result.difficultsUpdatedAt;
    if (typeof result.difficultsVersion === "number") difficultsVersion = result.difficultsVersion;
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();
  }
}

function handleReviewCurrentWord(delta, button) {
  const current = getCurrentWord();
  if (!current) return;

  flashReviewButton(button);
  updateReviewScore(reviewScores, current, delta);
  finishReviewScoreChange();
}

function handleResetReviewCurrentWord() {
  const current = getCurrentWord();
  if (!current) return;

  flashReviewButton(resetReviewBtnEl);
  resetReviewScore(reviewScores, current);
  finishReviewScoreChange();
}

function finishReviewScoreChange() {
  reviewScoresVersion += 1;
  saveReviewScoresToLocalOnly(reviewScores);
  renderLayout();
  updateReviewButtons();
}
function flashReviewButton(button) {
  if (!button) return;
  button.classList.remove("review-flash");
  void button.offsetWidth;
  button.classList.add("review-flash");
  window.setTimeout(() => button.classList.remove("review-flash"), 500);
}

function finishInitialLoading() {
  if (hasFinishedInitialLoading) return;
  hasFinishedInitialLoading = true;

  requestAnimationFrame(() => {
    document.body.classList.remove("loading");

    requestAnimationFrame(() => {
      render();
    });
  });
}

function bindUIEvents() {
  loginBtnEl?.addEventListener("click", () => signInWithGoogle(auth, provider));
  logoutBtnEl?.addEventListener("click", () => signOutUser(auth));
  toggleSidebarBtnEl?.addEventListener("click", toggleSidebar);
  speechSyncBtnEl?.addEventListener("click", toggleSpeechSync);
  challengeBtnEl?.addEventListener("click", toggleChallengeMode);
  translationBtnEl?.addEventListener("click", toggleTranslationMode);
  autoPlayBtnEl?.addEventListener("click", toggleAutoPlay);
  randomBtnEl?.addEventListener("click", toggleRandomMode);
  frequencyBtnEl?.addEventListener("click", toggleFrequencyMode);
  favoriteListBtnEl?.addEventListener("click", handleLoadFavoritesMode);
  difficultListBtnEl?.addEventListener("click", handleLoadDifficultsMode);
  favoriteToggleBtnEl?.addEventListener("click", handleToggleFavoriteCurrentWord);
  difficultToggleBtnEl?.addEventListener("click", handleToggleDifficultCurrentWord);
  decreaseReviewBtnEl?.addEventListener("click", () => handleReviewCurrentWord(-1, decreaseReviewBtnEl));
  resetReviewBtnEl?.addEventListener("click", handleResetReviewCurrentWord);
  increaseReviewBtnEl?.addEventListener("click", () => handleReviewCurrentWord(1, increaseReviewBtnEl));
  [decreaseReviewBtnEl, resetReviewBtnEl, increaseReviewBtnEl].forEach((button) => {
    button?.addEventListener("mouseenter", updateReviewButtons);
    button?.addEventListener("focus", updateReviewButtons);
  });
  prevWordBtnEl?.addEventListener("click", prevWord);
  nextWordBtnEl?.addEventListener("click", nextWord);
  speakWordBtnEl?.addEventListener("click", handleSpeakCurrentWord);
  document.querySelector(".center-box")?.addEventListener("click", handleAutoPlaySkipRequest);

  searchInputEl?.addEventListener("input", () => {
    setSearchQuery(searchInputEl.value);
    requestListRebuild();
    renderLayout();
  });

  if (timeSlider && timeValue) {
    timeSlider.value = Math.min(challengeTime / 1000, Number(timeSlider.max));
    timeValue.textContent = (challengeTime / 1000).toFixed(1);

    timeSlider.addEventListener("input", () => {
      challengeTime = parseFloat(timeSlider.value) * 1000;
      timeValue.textContent = parseFloat(timeSlider.value).toFixed(1);
      saveChallengeTimeState(challengeTime);

      if (challengeMode && !isAutoPlayActive()) {
        renderCurrentWord();
      }
    });
  }
  if (displayTimeSlider && displayTimeValue) {
    displayTimeSlider.value = Math.min(displayTime / 1000, Number(displayTimeSlider.max));
    displayTimeValue.textContent = (displayTime / 1000).toFixed(1);

    displayTimeSlider.addEventListener("input", () => {
      displayTime = parseFloat(displayTimeSlider.value) * 1000;
      displayTimeValue.textContent = parseFloat(displayTimeSlider.value).toFixed(1);
      saveDisplayTimeState(displayTime);
    });
  }
  volButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const volName = button.dataset.vol;
      if (volName) {
        loadSheet(volName);
      }
    });
  });

  listEl?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".word-item") : null;
    if (!(target instanceof HTMLElement)) return;

    const nextIndex = Number(target.dataset.index);
    if (Number.isNaN(nextIndex)) return;

    navMoveToIndex(nextIndex, { pushHistory: true });
    scheduleAutoPlayAfterRender();
  });
}

function getDefaultSidebarOpen() {
  return !window.matchMedia?.("(pointer: coarse)").matches;
}
function loadSavedState() {
  const savedVol = safeGetItem(STORAGE_KEYS.vol);
  const savedSidebarOpen = safeGetItem(STORAGE_KEYS.sidebarOpen);
  const savedSpeechSync = safeGetItem(STORAGE_KEYS.speechSync);
  const savedIndexByVol = safeGetItem(STORAGE_KEYS.indexByVol);
  const savedFavorites = safeGetItem(STORAGE_KEYS.favorites);
  const savedDifficults = safeGetItem(STORAGE_KEYS.difficults);
  const savedReviewScores = safeGetItem(STORAGE_KEYS.reviewScores);
  const savedFavoritesUpdatedAt = safeGetItem(STORAGE_KEYS.favoritesUpdatedAt);
  const savedDifficultsUpdatedAt = safeGetItem(STORAGE_KEYS.difficultsUpdatedAt);
  const savedChallengeMode = safeGetItem(STORAGE_KEYS.challengeMode);
  const savedChallengeTime = safeGetItem(STORAGE_KEYS.challengeTime);
  const savedDisplayTime = safeGetItem(STORAGE_KEYS.displayTime);
  const savedTranslationMode = safeGetItem(STORAGE_KEYS.translationMode);
  const savedAutoPlay = safeGetItem(STORAGE_KEYS.autoPlay);
  const savedRandomMode = safeGetItem(STORAGE_KEYS.randomMode);
  const savedFrequencyMode = safeGetItem(STORAGE_KEYS.frequencyMode);
  const savedMode = safeGetItem(STORAGE_KEYS.mode);

  if (savedVol && availableVolumes[savedVol]) currentVol = savedVol;
  sidebarOpen = savedSidebarOpen !== null ? savedSidebarOpen === "true" : getDefaultSidebarOpen();
  if (savedSpeechSync !== null) speechSync = savedSpeechSync === "true";

  if (savedIndexByVol) {
    try {
      indexByVol = { ...indexByVol, ...JSON.parse(savedIndexByVol) };
    } catch (error) {
      console.warn("indexByVol restore failed", error);
    }
  }

  if (savedMode === "favorites" || savedMode === "difficults") {
    currentMode = savedMode;
  }

  if (savedFavorites) {
    try {
      const parsedFavorites = JSON.parse(savedFavorites);
      favorites = parsedFavorites && typeof parsedFavorites === "object" ? parsedFavorites : {};
    } catch {
      favorites = {};
    }
  }


  if (savedDifficults) {
    try {
      const parsedDifficults = JSON.parse(savedDifficults);
      difficults = parsedDifficults && typeof parsedDifficults === "object" ? parsedDifficults : {};
    } catch {
      difficults = {};
    }
  }
  if (savedReviewScores) {
    try {
      const parsedReviewScores = JSON.parse(savedReviewScores);
      reviewScores = parsedReviewScores && typeof parsedReviewScores === "object" ? parsedReviewScores : {};
    } catch {
      reviewScores = {};
    }
  }

  if (savedFavoritesUpdatedAt) {
    favoritesUpdatedAt = Number(savedFavoritesUpdatedAt) || 0;
  }

  if (savedDifficultsUpdatedAt) {
    difficultsUpdatedAt = Number(savedDifficultsUpdatedAt) || 0;
  }

  if (savedChallengeMode !== null) challengeMode = savedChallengeMode === "true";

  if (savedChallengeTime !== null) {
    const parsedTime = Number(savedChallengeTime);
    if (!Number.isNaN(parsedTime)) {
      challengeTime = Math.min(Math.max(parsedTime, 1000), 5000);
    }
  }

  if (savedDisplayTime !== null) {
    const parsedTime = Number(savedDisplayTime);
    if (!Number.isNaN(parsedTime)) {
      displayTime = Math.min(Math.max(parsedTime, 1000), 5000);
    }
  }

  if (savedTranslationMode !== null) translationMode = savedTranslationMode === "true";
  if (savedAutoPlay === "once") {
    autoPlayMode = "once";
  }
  if (savedRandomMode !== null) randomMode = savedRandomMode === "true";
  if (savedFrequencyMode !== null) frequencyMode = savedFrequencyMode === "true";

  updateSpeechSyncButton();
  updateChallengeButton();
  updateTranslationButton();
  updateAutoPlayButton();
  updateRandomButton();
  updateFrequencyButton();
  applySidebarState();
}

function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    uiUpdateAuthUI(uiContext);

    if (favoritesUnsubscribe) {
      favoritesUnsubscribe();
      favoritesUnsubscribe = null;
    }

    if (!user) {
      clearUserMarksForLoggedOut();
      setAppLocked(true, "Googleログインしてください");
      finishInitialLoading();
      return;
    }

    setAppLocked(false);

    await loadFavoritesFromCloud();
    await loadDifficultsFromCloud();
    subscribeFavoritesRealtime();

    allWordsByVol = createInitialWordsByVol();
    clearAllShuffleCache();
    navClearNavigationHistory();

    if (currentMode === "favorites") {
      await handleLoadFavoritesMode();
    } else if (currentMode === "difficults") {
      await handleLoadDifficultsMode();
    } else {
      await loadSheet(currentVol);
    }
  });
}

function clearUserMarksForLoggedOut() {
  favorites = {};
  difficults = {};
  favoritesUpdatedAt = 0;
  difficultsUpdatedAt = 0;
  favoritesVersion += 1;
  difficultsVersion += 1;
  clearAllShuffleCache();
  requestListRebuild();
  render();
}

function setAppLocked(isLocked, message = "Googleログインしてください") {
  const controls = [
    toggleSidebarBtnEl,
    favoriteListBtnEl,
    difficultListBtnEl,
    speechSyncBtnEl,
    challengeBtnEl,
    translationBtnEl,
    autoPlayBtnEl,
    randomBtnEl,
    frequencyBtnEl,
    favoriteToggleBtnEl,
    difficultToggleBtnEl,
    decreaseReviewBtnEl,
    resetReviewBtnEl,
    increaseReviewBtnEl,
    prevWordBtnEl,
    nextWordBtnEl,
    speakWordBtnEl,
    timeSlider,
    displayTimeSlider,
    searchInputEl,
    ...volButtons
  ];

  controls.forEach((control) => {
    if (!control) return;
    control.disabled = isLocked;
    control.classList.toggle("disabled", isLocked);
  });

  if (!isLocked) {
    wordEl?.classList.remove("status-message");
    updateSpeechSyncButton();
    updateChallengeButton();
    updateTranslationButton();
    updateAutoPlayButton();
    updateRandomButton();
    updateFrequencyButton();
    updateFavoriteToggleButton();
    updateDifficultToggleButton();
    updateReviewButtons();
    applySidebarState();
    return;
  }

  allWordsByVol = createInitialWordsByVol();
  words = [];
  index = 0;
  sidebarOpen = false;
  clearMeaningRevealTimer();
  clearSpeechSyncTimer();
  clearAutoPlayTimer();
  navClearNavigationHistory();
  requestListRebuild();
  applySidebarState();

  if (listEl) listEl.innerHTML = "";
  if (wordEl) {
    wordEl.textContent = message;
    wordEl.classList.add("status-message");
  }
  if (meaningEl) meaningEl.textContent = "";
  if (progressEl) progressEl.textContent = "";
  if (pronunciationEl) pronunciationEl.textContent = "";
  if (prevHintEl) prevHintEl.textContent = "";
  if (nextHintEl) nextHintEl.textContent = "";

  updateFavoriteToggleButton();
  updateDifficultToggleButton();
  updateReviewButtons();
  updateRandomButton();
  updateFrequencyButton();
}

function subscribeFavoritesRealtime() {
  if (!currentUser) return;

  favoritesUnsubscribe = subscribeFavoritesRealtimeRemote(db, FAVORITES_COLLECTION, currentUser.uid, (snap) => {
    const result = resolveFavoritesSnapshot(snap, favoritesUpdatedAt);
    const difficultsResult = resolveDifficultsSnapshot(snap, difficultsUpdatedAt);

    if (!result && !difficultsResult) return;

    if (result) {
      favorites = result.favorites;
      favoritesUpdatedAt = result.favoritesUpdatedAt;
      favoritesVersion += 1;

      saveFavoritesToLocalOnly(favorites);
      saveFavoritesUpdatedAt(favoritesUpdatedAt);
      clearAllShuffleCache();
      requestListRebuild();

      if (currentMode === "favorites") {
        applyWordOrder(false);
        index = Math.min(index, Math.max(words.length - 1, 0));
      }
    }

    if (difficultsResult) {
      difficults = difficultsResult.difficults;
      difficultsUpdatedAt = difficultsResult.difficultsUpdatedAt;
      difficultsVersion += 1;

      saveDifficultsToLocalOnly(difficults);
      saveDifficultsUpdatedAt(difficultsUpdatedAt);
      clearAllShuffleCache();
      requestListRebuild();

      if (currentMode === "difficults") {
        applyWordOrder(false);
        index = Math.min(index, Math.max(words.length - 1, 0));
      }
    }

    render();
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();
  });
}

async function loadFavoritesFromCloud() {
  if (!currentUser) return;

  try {
    const result = await syncFavoritesWithCloud(
      db,
      FAVORITES_COLLECTION,
      currentUser.uid,
      favorites,
      favoritesUpdatedAt
    );

    favorites = result.favorites;
    favoritesUpdatedAt = result.favoritesUpdatedAt;
    favoritesVersion += 1;
    saveFavoritesToLocalOnly(favorites);
    saveFavoritesUpdatedAt(favoritesUpdatedAt);
  } catch (error) {
    console.error("クラウド読み込み失敗:", error);
  }
}

async function loadDifficultsFromCloud() {
  if (!currentUser) return;

  try {
    const result = await syncDifficultsWithCloud(
      db,
      FAVORITES_COLLECTION,
      currentUser.uid,
      difficults,
      difficultsUpdatedAt
    );

    difficults = result.difficults;
    difficultsUpdatedAt = result.difficultsUpdatedAt;
    difficultsVersion += 1;
    saveDifficultsToLocalOnly(difficults);
    saveDifficultsUpdatedAt(difficultsUpdatedAt);
  } catch (error) {
    console.error("クラウド読み込み失敗:", error);
  }
}

async function saveFavoritesToCloud() {
  if (!currentUser) return;

  try {
    await saveFavoritesToCloudRemote(db, FAVORITES_COLLECTION, currentUser.uid, favorites, favoritesUpdatedAt);
  } catch (error) {
    console.error("クラウド保存失敗:", error);
  }
}

async function saveDifficultsToCloud() {
  if (!currentUser) return;

  try {
    await saveDifficultsToCloudRemote(db, FAVORITES_COLLECTION, currentUser.uid, difficults, difficultsUpdatedAt);
  } catch (error) {
    console.error("クラウド保存失敗:", error);
  }
}

async function ensureVolLoaded(volName) {
  if (!allWordsByVol[volName] || allWordsByVol[volName].length === 0) {
    allWordsByVol[volName] = await fetchWordsForVol(volName);
  }
}

async function ensureAllVolumesLoaded() {
  const results = await Promise.allSettled(volOrder.map((vol) => ensureVolLoaded(vol)));
  const failures = results.filter((result) => result.status === "rejected");

  if (failures.length === results.length) {
    throw failures[0].reason;
  }

  if (failures.length > 0) {
    console.warn("Some volumes failed to load", failures.map((failure) => failure.reason));
  }
}

async function loadSheet(volName) {
  const isChangingVol = currentMode !== "vol" || currentVol !== volName;
  if (isChangingVol && isAutoPlayActive()) {
    stopAutoPlay();
  }

  if (!currentUser) {
    return;
  }

  try {
    currentMode = "vol";
    currentVol = volName;
    navClearNavigationHistory();
    wordOrderUpdatePending = false;
    saveCurrentVol(currentVol);
    saveCurrentModeState(currentMode);
    // 指定ボリュームを先に読み込み、words を確実に設定する
    await ensureVolLoaded(volName);
    clearAllShuffleCache();
    applyWordOrder();
    index = Math.min(indexByVol[volName] || 0, Math.max(words.length - 1, 0));

    requestListRebuild();
    render();
    finishInitialLoading();
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();

    preloadOtherVolumesInBackground();
  } catch (error) {
    console.error(error);
    finishInitialLoading();
    if (error?.code === "permission-denied") {
      setAppLocked(true, "このアプリは管理者のみ利用できます");
      alert("このアプリは現在、管理者のみ利用できます。");
      return;
    }
    alert("読み込みに失敗しました。Firestoreの単語CSVデータをご確認ください。");
  }
}

async function preloadOtherVolumesInBackground() {
  const otherVols = volOrder.filter((vol) => vol !== currentVol);
  await Promise.all(otherVols.map((vol) => ensureVolLoaded(vol).catch(() => {})));
}

function makeShuffleKey(orderMode) {
  const scope = currentMode === "favorites"
    ? "favorites:all"
    : currentMode === "difficults"
      ? "difficults:all"
      : `vol:${currentVol}`;
  return `${orderMode}:${scope}`;
}

function shuffleArray(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function applyWordOrder(resetIndex = false, preserveCurrentId = null) {
  const baseWords = currentMode === "favorites"
    ? buildFavoriteEntries(allWordsByVol, volOrder, favorites)
    : currentMode === "difficults"
      ? buildDifficultEntries(allWordsByVol, volOrder, difficults)
      : [...(allWordsByVol[currentVol] || [])];

  if (randomMode || frequencyMode) {
    const orderMode = randomMode && frequencyMode
      ? "frequency-random"
      : frequencyMode
        ? "frequency"
        : "random";
    const shuffleKey = makeShuffleKey(orderMode);
    const currentCache = shuffledWordsMap[shuffleKey];

    const cacheValid =
      Array.isArray(currentCache) &&
      currentCache.length === baseWords.length &&
      currentCache.every((item) => baseWords.some((base) => base.id === item.id));

    if (!cacheValid) {
      shuffledWordsMap[shuffleKey] = frequencyMode
        ? sortByReviewScore(baseWords, (item) => getReviewScore(reviewScores, item), { randomizeTies: randomMode })
        : shuffleArray(baseWords);
    }

    words = shuffledWordsMap[shuffleKey];
  } else {
    words = baseWords;
  }

  if (preserveCurrentId) {
    const preservedIndex = words.findIndex((item) => item && item.id === preserveCurrentId);
    index = preservedIndex >= 0 ? preservedIndex : Math.min(index, Math.max(words.length - 1, 0));
  } else {
    index = resetIndex ? 0 : Math.min(index, Math.max(words.length - 1, 0));
  }
}

function clearAllShuffleCache() {
  shuffledWordsMap = {};
}

function requestListRebuild() {
  listNeedsRebuild = true;
  listVersion += 1;
}

function setListNeedsRebuild(value) {
  listNeedsRebuild = value;
}

function setRenderedListVersion(value) {
  renderedListVersion = value;
}

function setSearchQuery(value) {
  searchQuery = value.trim();
  if (searchInputEl && searchInputEl.value !== value) {
    searchInputEl.value = value;
  }
}

function persistCurrentIndex() {
  if (currentMode === "favorites") {
    indexByVol.favorites = index;
  } else if (currentMode === "difficults") {
    indexByVol.difficults = index;
  } else {
    indexByVol[currentVol] = index;
  }
  saveIndexByVol(indexByVol);
}

function setMeaningRevealTimer(timer) {
  meaningRevealTimer = timer;
}

function render() {
  renderApp(uiContext);
}

function renderCurrentWord() {
  renderCurrentWordUI(uiContext);
}

function renderLayout() {
  renderApp(uiContext, { skipCurrentWord: true });
}

function updateSpeechSyncButton() {
  uiUpdateSpeechSyncButton(uiContext);
}

function updateRecallTimeControl() {
  uiUpdateRecallTimeControl(uiContext);
}

function updateChallengeButton() {
  uiUpdateChallengeButton(uiContext);
  updateRecallTimeControl();
}

function updateTranslationButton() {
  uiUpdateTranslationButton(uiContext);
}

function updateAutoPlayButton() {
  uiUpdateAutoPlayButton(uiContext);
  updateRecallTimeControl();
}

function updateRandomButton() {
  uiUpdateRandomButton(uiContext);
}

function updateFrequencyButton() {
  uiUpdateFrequencyButton(uiContext);
}

function updateFavoriteToggleButton() {
  uiUpdateFavoriteToggleButton(uiContext);
}

function updateDifficultToggleButton() {
  uiUpdateDifficultToggleButton(uiContext);
}

function updateReviewButtons() {
  uiUpdateReviewButtons(uiContext);
}

function applySidebarState() {
  uiApplySidebarState(uiContext);
}

function clearMeaningRevealTimer() {
  if (meaningRevealTimer) {
    clearTimeout(meaningRevealTimer);
    meaningRevealTimer = null;
  }
}

function clearSpeechSyncTimer() {
  if (speechSyncTimer) {
    clearTimeout(speechSyncTimer);
    speechSyncTimer = null;
  }
}

function clearAutoPlayTimer() {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = null;
  }

  if (autoPlayDisplayPhaseTimer) {
    clearTimeout(autoPlayDisplayPhaseTimer);
    autoPlayDisplayPhaseTimer = null;
  }
}

function isAutoPlayActive() {
  return autoPlayMode !== "off";
}

function stopAutoPlay() {
  autoPlayMode = "off";
  autoPlayOnceStartPoint = null;
  saveAutoPlayState(autoPlayMode);
  updateAutoPlayButton();
  clearAutoPlayTimer();
}

function getAutoPlayPoint(targetIndex = index) {
  return {
    mode: currentMode,
    vol: currentMode === "vol" ? currentVol : null,
    index: targetIndex
  };
}

function isSameAutoPlayPoint(a, b) {
  return Boolean(a && b && a.mode === b.mode && a.vol === b.vol && a.index === b.index);
}


function shouldStopAutoPlayOnce(nextIndex) {
  return autoPlayMode === "once" && isSameAutoPlayPoint(autoPlayOnceStartPoint, getAutoPlayPoint(nextIndex));
}
function getAutoPlayDelay() {
  return challengeMode ? challengeTime + displayTime : displayTime;
}

function getCurrentAnswerText() {
  const current = getCurrentWord();
  if (!current) return "";
  return translationMode ? current.word : current.meaning;
}

function isAutoPlaySkipIgnoredTarget(target) {
  return target instanceof Element && Boolean(target.closest("button, input, textarea, select, a, .word-item"));
}

function isAutoPlaySkipLocked() {
  return Date.now() - autoPlayWaitStartedAt < AUTO_PLAY_SKIP_LOCK_MS;
}

function revealCurrentMeaningImmediately() {
  if (!meaningEl || meaningEl.textContent !== "\u30fb\u30fb\u30fb") return false;
  clearMeaningRevealTimer();
  meaningEl.textContent = getCurrentAnswerText();
  return true;
}

function scheduleAutoPlayToNext(delay) {
  clearAutoPlayTimer();
  autoPlayWaitStartedAt = Date.now();
  autoPlayTimer = setTimeout(() => {
    nextWord();
  }, delay);
}

function handleAutoPlaySkipRequest(event) {
  if (!isAutoPlayActive() || !words.length) return;
  if (isAutoPlaySkipIgnoredTarget(event.target)) return;
  if (isAutoPlaySkipLocked()) return;

  if (challengeMode && revealCurrentMeaningImmediately()) {
    scheduleAutoPlayToNext(displayTime);
    return;
  }

  nextWord();
}

function scheduleAutoPlay() {
  if (!isAutoPlayActive() || !words.length) return;
  clearAutoPlayTimer();
  autoPlayWaitStartedAt = Date.now();

  if (challengeMode) {
    autoPlayDisplayPhaseTimer = setTimeout(() => {
      autoPlayWaitStartedAt = Date.now();
      autoPlayDisplayPhaseTimer = null;
    }, challengeTime);
  }

  autoPlayTimer = setTimeout(() => {
    nextWord();
  }, getAutoPlayDelay());
}

function scheduleAutoPlayAfterRender() {
  if (!isAutoPlayActive()) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scheduleAutoPlay();
    });
  });
}

function startAutoPlayFromCurrentWord() {
  scheduleAutoPlay();
}
function scheduleSpeechSync() {
  if (!speechSync) return;
  clearSpeechSyncTimer();
  speechSyncTimer = setTimeout(() => {
    speakWord();
  }, 260);
}

function scheduleSpeechSyncAfterRender() {
  if (!speechSync) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scheduleSpeechSync();
    });
  });
}

function getCurrentWord() {
  return words[index] || null;
}

function handleSpeakCurrentWord() {
  speakWord();
  scheduleAutoPlay();
}
function focusSearch() {
  if (!searchInputEl || !currentUser) return;
  if (!sidebarOpen) {
    sidebarOpen = true;
    saveSidebarState(sidebarOpen);
    applySidebarState();
  }
  searchInputEl.focus();
  searchInputEl.select();
}

function clearSearch() {
  if (!searchInputEl || searchInputEl.value === "") return false;
  setSearchQuery("");
  requestListRebuild();
  renderLayout();
  return true;
}

function getSearchResultItems() {
  return Array.from(listEl?.querySelectorAll(".word-item:not(.empty-result)") || [])
    .filter((item) => item instanceof HTMLElement);
}

function moveToSearchResult(direction) {
  const resultItems = getSearchResultItems();
  if (!resultItems.length) return;

  const activeResultIndex = resultItems.findIndex((item) => Number(item.dataset.index) === index);
  const fallbackIndex = direction > 0 ? 0 : resultItems.length - 1;
  const nextResultIndex = activeResultIndex >= 0
    ? (activeResultIndex + direction + resultItems.length) % resultItems.length
    : fallbackIndex;
  const nextItem = resultItems[nextResultIndex];
  if (!(nextItem instanceof HTMLElement)) return;

  const nextIndex = Number(nextItem.dataset.index);
  if (Number.isNaN(nextIndex)) return;

  navMoveToIndex(nextIndex, { pushHistory: true });
  scheduleAutoPlayAfterRender();
}

function selectNextSearchResult() {
  moveToSearchResult(1);
}

function selectPreviousSearchResult() {
  moveToSearchResult(-1);
}

function closeSidebar() {
  if (!sidebarOpen) return;
  sidebarOpen = false;
  saveSidebarState(sidebarOpen);
  applySidebarState();
}
function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  saveSidebarState(sidebarOpen);
  applySidebarState();
}

function toggleSpeechSync() {
  speechSync = !speechSync;
  saveSpeechSyncState(speechSync);
  updateSpeechSyncButton();

  if (!speechSync) {
    clearSpeechSyncTimer();
  } else {
    scheduleSpeechSync();
  }
}

function refreshCurrentWordAfterSettingChange() {
  if (isAutoPlayActive()) return;
  renderCurrentWord();
  scheduleSpeechSyncAfterRender();
}

function applyPendingWordOrderAsNext() {
  if (!wordOrderUpdatePending) return false;

  wordOrderUpdatePending = false;
  applyWordOrder(true);
  requestListRebuild();
  render();
  scheduleSpeechSyncAfterRender();
  scheduleAutoPlayAfterRender();
  persistCurrentIndex();
  return true;
}
function toggleChallengeMode() {
  challengeMode = !challengeMode;
  saveChallengeModeState(challengeMode);
  updateChallengeButton();
  refreshCurrentWordAfterSettingChange();
}

function toggleTranslationMode() {
  translationMode = !translationMode;
  saveTranslationModeState(translationMode);
  updateTranslationButton();
  refreshCurrentWordAfterSettingChange();
}

function toggleAutoPlay() {
  autoPlayMode = autoPlayMode === "off" ? "once" : "off";
  autoPlayOnceStartPoint = autoPlayMode === "once" ? getAutoPlayPoint() : null;
  saveAutoPlayState(autoPlayMode);
  updateAutoPlayButton();

  if (!isAutoPlayActive()) {
    clearAutoPlayTimer();
  } else {
    startAutoPlayFromCurrentWord();
  }
}

function toggleRandomMode() {
  randomMode = !randomMode;
  saveRandomModeState(randomMode);
  updateRandomButton();
  navClearNavigationHistory();
  clearAllShuffleCache();

  if (isAutoPlayActive()) {
    wordOrderUpdatePending = true;
    return;
  }

  wordOrderUpdatePending = false;
  applyWordOrder(true);
  requestListRebuild();
  render();
  scheduleSpeechSyncAfterRender();
}

function toggleFrequencyMode() {
  frequencyMode = !frequencyMode;
  saveFrequencyModeState(frequencyMode);
  updateFrequencyButton();
  navClearNavigationHistory();
  clearAllShuffleCache();

  if (isAutoPlayActive()) {
    wordOrderUpdatePending = true;
    return;
  }

  wordOrderUpdatePending = false;
  applyWordOrder(true);
  requestListRebuild();
  render();
  scheduleSpeechSyncAfterRender();
}

function prevWord() {
  if (!words.length) return;
  if (applyPendingWordOrderAsNext()) return;

  if (randomMode) {
    const historyIndex = navGetRandomPrevIndexFromHistory();
    if (historyIndex !== null) {
      index = historyIndex;
      renderCurrentWord();
      scheduleSpeechSync();
      scheduleAutoPlay();
      persistCurrentIndex();
      return;
    }
  }

  const prevIndex = (index - 1 + words.length) % words.length;
  navMoveToIndex(prevIndex, { pushHistory: randomMode });
  scheduleAutoPlayAfterRender();
}

function nextWord() {
  if (!words.length) return;
  if (applyPendingWordOrderAsNext()) return;

  if (randomMode) {
    const historyIndex = navGetRandomNextIndexFromHistory();
    if (historyIndex !== null) {
      index = historyIndex;
      renderCurrentWord();
      scheduleSpeechSync();
      scheduleAutoPlay();
      persistCurrentIndex();
      return;
    }
  }

  const nextIndex = (index + 1) % words.length;
  if (shouldStopAutoPlayOnce(nextIndex)) {
    stopAutoPlay();
    return;
  }
  navMoveToIndex(nextIndex, { pushHistory: randomMode });
  scheduleAutoPlayAfterRender();
}

export { init, finishInitialLoading };



