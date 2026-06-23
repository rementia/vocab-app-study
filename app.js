import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-auth.js";
import { availableVolumes, fetchWordsForVol, fetchWordsForVolWithMeta } from './data.js';
import { getDomElements } from './dom.js';
import { SHEET_SYNC_TOKEN, SHEET_SYNC_WEB_APP_URL } from './syncConfig.js';
import { syncSheetToFirestore } from './sheetSyncService.js';
import { auth, db, provider } from './firebaseClient.js';
import {
  USER_MARKS_COLLECTION,
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
  saveMultipleChoiceModeState,
  saveAutoPlayState,
  saveRandomModeState,
  saveFrequencyModeState
} from './storage.js';
import { readSavedAppState } from './savedState.js';
import { buildWordOrder } from './wordOrder.js';
import {
  renderApp,
  renderCurrentWord as renderCurrentWordUI,
  updateSpeechSyncButton as uiUpdateSpeechSyncButton,
  updateChallengeButton as uiUpdateChallengeButton,
  updateRecallTimeControl as uiUpdateRecallTimeControl,
  updateTranslationButton as uiUpdateTranslationButton,
  updateMultipleChoiceButton as uiUpdateMultipleChoiceButton,
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
  getReviewWeight,
  recordReviewAnswer,
  updateReviewScore,
  resetReviewScore,
  sortByReviewScore
} from './reviewManager.js';
import { clampIndex } from './wordList.js';
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
  loadPronunciation,
  unlockPronunciationAudioOnce
} from './pronunciation.js';
import {
  buildMultipleChoiceQuestion,
  getMultipleChoiceDirection
} from './multipleChoice.js';
import { createSpeechSyncController } from './speechSyncController.js';
import { getNextSearchResultIndex } from './searchController.js';
import { formatReloadSuccessMessage, getPreserveWordId, getReloadedIndex } from './wordReloadService.js';
import { createReloadStatusController } from './reloadStatusService.js';
import {
  subscribeUserMarksRealtimeRemote,
  saveFavoritesToCloudRemote,
  saveDifficultsToCloudRemote,
  syncUserMarksWithCloud,
  resolveUserMarksSnapshot
} from './userMarksCloud.js';
const {
  searchInputEl,
  reloadWordsBtnEl,
  reloadWordsStatusEl,
  listEl,
  sidebarEl,
  wordSlideCardEl,
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
  multipleChoiceBtnEl,
  multipleChoicePanelEl,
  multipleChoiceQuestionEl,
  multipleChoiceOptionsEl,
  multipleChoiceFeedbackEl,
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
let userMarksUnsubscribe = null;

let allWordsByVol = createInitialWordsByVol();
let loadedVolumes = new Set();

let words = [];
let index = 0;
let currentVol = "vol1";
let currentMode = "vol";
let sidebarOpen = true;
let favorites = {};
let difficults = {};
let reviewScores = {};
let favoritesUpdatedAt = 0;
let difficultsUpdatedAt = 0;
let challengeMode = false;
let challengeTime = 1500;
let displayTime = 1500;
let translationMode = false;
let multipleChoiceMode = false;
let autoPlayMode = "off";
let autoPlayOnceStartPoint = null;
let randomMode = false;
let frequencyMode = false;

let meaningRevealTimer = null;
let autoPlayTimer = null;
let autoPlayDisplayPhaseTimer = null;
let autoPlayWaitStartedAt = 0;
let wordOrderUpdatePending = false;
let hasFinishedInitialLoading = false;
let multipleChoiceQuestion = null;
let multipleChoiceAnswer = null;
let multipleChoiceRevealedOptionIndexes = new Set();

let listNeedsRebuild = true;
let renderedListVersion = "";
let listVersion = 0;
let favoritesVersion = 0;
let difficultsVersion = 0;
let reviewScoresVersion = 0;
let searchQuery = "";
let isReloadingWords = false;

let indexByVol = createInitialIndexByVol();

const reloadWordsStatus = createReloadStatusController({
  setStatus: (message) => {
    if (reloadWordsStatusEl) reloadWordsStatusEl.textContent = message;
  },
  setTimeoutFn: window.setTimeout.bind(window),
  clearTimeoutFn: window.clearTimeout.bind(window)
});

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
    multipleChoiceMode,
    multipleChoiceAnswer,
    multipleChoiceRevealedOptionIndexes: [...multipleChoiceRevealedOptionIndexes],
    autoPlayMode,
    historyBackStack: getHistoryBackStack(),
    historyForwardStack: getHistoryForwardStack(),
    sidebarOpen,
    speechSync: speechSyncController.isEnabled(),
    currentUser
  }),
  dom: {
    searchInputEl,
    reloadWordsBtnEl,
    reloadWordsStatusEl,
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
    multipleChoiceBtnEl,
    multipleChoicePanelEl,
    multipleChoiceQuestionEl,
    multipleChoiceOptionsEl,
    multipleChoiceFeedbackEl,
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
    getMultipleChoiceQuestion,
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
const SPEECH_SYNC_DELAY_MS = 260;
const MIN_RECALL_TIME_MS = 1000;
const MAX_RECALL_TIME_MS = 5000;

let wordOrderCache = {};

const speechSyncController = createSpeechSyncController({
  delayMs: SPEECH_SYNC_DELAY_MS,
  saveSpeechSyncState,
  updateSpeechSyncButton,
  speakWord,
  shouldBlockSpeech: () => multipleChoiceMode && !multipleChoiceAnswer,
  unlockPronunciationAudio: unlockPronunciationAudioOnce
});

async function init() {
  loadSavedState();
  initNavigation({
    getIndex: () => index,
    setIndex: (n) => { index = n; },
    renderCurrentWord,
    scheduleSpeechSync,
    getWordsLength: () => words.length
  });
  bindTouchEvents({ prevWord, nextWord, isSwipeAllowedTarget, swipeElement: wordSlideCardEl });
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
  initPronunciation({
    el: pronunciationEl,
    getCurrentWord
  });
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
    createMarkModeCallbacks({
      updateFavoriteToggleButton,
      getCurrentWord
    }),
    volOrder
  );

  applyModeLoadResult(result);
}

async function handleLoadDifficultsMode() {
  if (currentMode !== "difficults" && isAutoPlayActive()) {
    stopAutoPlay();
  }

  const result = await loadDifficultsModeManager(
    { allWordsByVol, currentMode, indexByVol, difficults, words, randomMode, frequencyMode },
    createMarkModeCallbacks({ updateDifficultToggleButton }),
    volOrder
  );

  applyModeLoadResult(result);
}

function createMarkModeCallbacks(extraCallbacks = {}) {
  return {
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
    getWords: () => words,
    setCurrentMode: (mode) => { currentMode = mode; },
    setRandomMode: (value) => { randomMode = value; },
    setFrequencyMode: (value) => { frequencyMode = value; },
    ...extraCallbacks
  };
}

function applyModeLoadResult(result) {
  if (!result) return;

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
    createUserMarkToggleCallbacks({
      saveFavoritesToLocalOnly,
      saveFavoritesUpdatedAt,
      updateFavoriteToggleButton,
      saveFavoritesToCloud
    })
  );

  if (result) {
    applyFavoriteToggleResult(result);
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
    createUserMarkToggleCallbacks({
      saveDifficultsToLocalOnly,
      saveDifficultsUpdatedAt,
      updateDifficultToggleButton,
      saveDifficultsToCloud
    })
  );

  if (result) {
    applyDifficultToggleResult(result);
  }
}

function createUserMarkToggleCallbacks(extraCallbacks) {
  return {
    getCurrentWord,
    getWords: () => words,
    clearWordOrderCache,
    requestListRebuild,
    applyWordOrder,
    saveIndexByVol,
    render,
    ...extraCallbacks
  };
}

function applyFavoriteToggleResult(result) {
  applyUserMarkToggleResult(result);
  if (typeof result.favoritesUpdatedAt === "number") favoritesUpdatedAt = result.favoritesUpdatedAt;
  if (typeof result.favoritesVersion === "number") favoritesVersion = result.favoritesVersion;
}

function applyDifficultToggleResult(result) {
  applyUserMarkToggleResult(result);
  if (typeof result.difficultsUpdatedAt === "number") difficultsUpdatedAt = result.difficultsUpdatedAt;
  if (typeof result.difficultsVersion === "number") difficultsVersion = result.difficultsVersion;
}

function applyUserMarkToggleResult(result) {
  if (typeof result.index === "number") index = result.index;
  if (result.currentMode) currentMode = result.currentMode;
  if (result.indexByVol) indexByVol = result.indexByVol;
  scheduleSpeechSyncAfterRender();
  scheduleAutoPlayAfterRender();
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
  clearWordOrderCache();
  if (frequencyMode) {
    applyWordOrder(false, getCurrentWord()?.id || null);
    requestListRebuild();
  }
  renderLayout();
  updateReviewButtons();
}

function finishReviewStatsChange(preserveCurrentId) {
  reviewScoresVersion += 1;
  saveReviewScoresToLocalOnly(reviewScores);
  clearWordOrderCache();

  if (frequencyMode) {
    applyWordOrder(false, preserveCurrentId);
    requestListRebuild();
  }

  renderLayout();
  updateReviewButtons();
}

function getMultipleChoiceQuestion() {
  if (!multipleChoiceMode) return null;

  const current = getCurrentWord();
  if (!current) {
    multipleChoiceQuestion = null;
    multipleChoiceAnswer = null;
    multipleChoiceRevealedOptionIndexes.clear();
    return null;
  }

  const direction = getMultipleChoiceDirection({ translationMode });
  if (
    !multipleChoiceQuestion ||
    multipleChoiceQuestion.wordId !== current.id ||
    multipleChoiceQuestion.direction !== direction
  ) {
    multipleChoiceQuestion = buildMultipleChoiceQuestion({
      current,
      allWordsByVol,
      volOrder,
      translationMode
    });
    multipleChoiceAnswer = null;
    multipleChoiceRevealedOptionIndexes.clear();
  }

  return multipleChoiceQuestion;
}

function handleMultipleChoiceOptionClick(event) {
  const button = event.target instanceof Element
    ? event.target.closest(".multiple-choice-option")
    : null;
  if (!(button instanceof HTMLElement)) return;

  const question = getMultipleChoiceQuestion();
  const current = getCurrentWord();
  if (!question || !current) return;

  const choiceIndex = Number(button.dataset.choiceIndex);
  const selectedOption = question.options[choiceIndex];
  if (!selectedOption) return;

  if (multipleChoiceAnswer) {
    if (!selectedOption.isCorrect) {
      if (multipleChoiceRevealedOptionIndexes.has(choiceIndex)) {
        multipleChoiceRevealedOptionIndexes.delete(choiceIndex);
      } else {
        multipleChoiceRevealedOptionIndexes.add(choiceIndex);
      }
      renderCurrentWord();
    }
    return;
  }

  multipleChoiceAnswer = {
    wordId: current.id,
    selectedText: selectedOption.text,
    correctText: question.correctText,
    isCorrect: selectedOption.isCorrect
  };

  recordReviewAnswer(reviewScores, current, selectedOption.isCorrect);
  finishReviewStatsChange(current.id);
  scheduleSpeechSync();
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
  bindAuthButtons();
  bindModeButtons();
  bindWordActionButtons();
  bindReviewButtons();
  bindSearchEvents();
  bindRecallTimeControls();
  bindVolumeButtons();
  bindWordListClicks();
}

function bindAuthButtons() {
  loginBtnEl?.addEventListener("click", () => signInWithGoogle(auth, provider));
  logoutBtnEl?.addEventListener("click", () => signOutUser(auth));
}

function bindModeButtons() {
  toggleSidebarBtnEl?.addEventListener("click", toggleSidebar);
  speechSyncBtnEl?.addEventListener("click", toggleSpeechSync);
  challengeBtnEl?.addEventListener("click", toggleChallengeMode);
  translationBtnEl?.addEventListener("click", toggleTranslationMode);
  multipleChoiceBtnEl?.addEventListener("click", toggleMultipleChoiceMode);
  autoPlayBtnEl?.addEventListener("click", toggleAutoPlay);
  randomBtnEl?.addEventListener("click", toggleRandomMode);
  frequencyBtnEl?.addEventListener("click", toggleFrequencyMode);
  favoriteListBtnEl?.addEventListener("click", handleLoadFavoritesMode);
  difficultListBtnEl?.addEventListener("click", handleLoadDifficultsMode);
}

function bindWordActionButtons() {
  favoriteToggleBtnEl?.addEventListener("click", handleToggleFavoriteCurrentWord);
  difficultToggleBtnEl?.addEventListener("click", handleToggleDifficultCurrentWord);
  prevWordBtnEl?.addEventListener("click", prevWord);
  nextWordBtnEl?.addEventListener("click", nextWord);
  speakWordBtnEl?.addEventListener("click", handleSpeakCurrentWord);
  multipleChoiceOptionsEl?.addEventListener("click", handleMultipleChoiceOptionClick);
  document.querySelector(".center-box")?.addEventListener("click", handleAutoPlaySkipRequest);
}

function bindReviewButtons() {
  decreaseReviewBtnEl?.addEventListener("click", () => handleReviewCurrentWord(-1, decreaseReviewBtnEl));
  resetReviewBtnEl?.addEventListener("click", handleResetReviewCurrentWord);
  increaseReviewBtnEl?.addEventListener("click", () => handleReviewCurrentWord(1, increaseReviewBtnEl));
  [decreaseReviewBtnEl, resetReviewBtnEl, increaseReviewBtnEl].forEach((button) => {
    button?.addEventListener("mouseenter", updateReviewButtons);
    button?.addEventListener("focus", updateReviewButtons);
  });
}

function bindSearchEvents() {
  searchInputEl?.addEventListener("input", () => {
    setSearchQuery(searchInputEl.value);
    requestListRebuild();
    renderLayout();
  });
  reloadWordsBtnEl?.addEventListener("click", handleReloadWords);
}

function bindRecallTimeControls() {
  if (timeSlider && timeValue) {
    setSecondsSliderValue(timeSlider, timeValue, challengeTime);

    timeSlider.addEventListener("input", () => {
      const seconds = readSliderSeconds(timeSlider);
      challengeTime = seconds * 1000;
      timeValue.textContent = formatSeconds(seconds);
      saveChallengeTimeState(challengeTime);

      if (challengeMode && !isAutoPlayActive()) {
        renderCurrentWord();
      }
    });
  }
  if (displayTimeSlider && displayTimeValue) {
    setSecondsSliderValue(displayTimeSlider, displayTimeValue, displayTime);

    displayTimeSlider.addEventListener("input", () => {
      const seconds = readSliderSeconds(displayTimeSlider);
      displayTime = seconds * 1000;
      displayTimeValue.textContent = formatSeconds(seconds);
      saveDisplayTimeState(displayTime);
    });
  }
}

function setSecondsSliderValue(slider, label, milliseconds) {
  const seconds = Math.min(milliseconds / 1000, Number(slider.max));
  slider.value = seconds;
  label.textContent = formatSeconds(seconds);
}

function readSliderSeconds(slider) {
  return parseFloat(slider.value);
}

function formatSeconds(seconds) {
  return seconds.toFixed(1);
}

function bindVolumeButtons() {
  volButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const volName = button.dataset.vol;
      if (volName) {
        loadSheet(volName);
      }
    });
  });
}

function bindWordListClicks() {
  listEl?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(".word-item") : null;
    const nextIndex = readWordItemIndex(target);
    if (nextIndex === null) return;

    navMoveToIndex(nextIndex, { pushHistory: true });
    scheduleAutoPlayAfterRender();
  });
}

function getDefaultSidebarOpen() {
  return !window.matchMedia?.("(pointer: coarse)").matches;
}

function loadSavedState() {
  const savedState = readSavedAppState({
    storageKeys: STORAGE_KEYS,
    safeGetItem,
    availableVolumes,
    defaults: {
      currentVol,
      currentMode,
      sidebarOpen,
      speechSync: speechSyncController.isEnabled(),
      indexByVol,
      favoritesUpdatedAt,
      difficultsUpdatedAt,
      challengeMode,
      challengeTime,
      displayTime,
      translationMode,
      multipleChoiceMode,
      randomMode,
      frequencyMode
    },
    getDefaultSidebarOpen,
    recallTimeRange: {
      min: MIN_RECALL_TIME_MS,
      max: MAX_RECALL_TIME_MS
    }
  });

  currentVol = savedState.currentVol;
  currentMode = savedState.currentMode;
  sidebarOpen = savedState.sidebarOpen;
  speechSyncController.setEnabled(savedState.speechSync);
  indexByVol = savedState.indexByVol;
  favorites = savedState.favorites;
  difficults = savedState.difficults;
  reviewScores = savedState.reviewScores;
  favoritesUpdatedAt = savedState.favoritesUpdatedAt;
  difficultsUpdatedAt = savedState.difficultsUpdatedAt;
  challengeMode = savedState.challengeMode;
  challengeTime = savedState.challengeTime;
  displayTime = savedState.displayTime;
  translationMode = savedState.translationMode;
  multipleChoiceMode = savedState.multipleChoiceMode;
  randomMode = savedState.randomMode;
  frequencyMode = savedState.frequencyMode;

  if (savedState.shouldResetAutoPlay) {
    saveAutoPlayState("off");
  }

  updateModeButtons();
  applySidebarState();
}

function setupAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    uiUpdateAuthUI(uiContext);

    if (userMarksUnsubscribe) {
      userMarksUnsubscribe();
      userMarksUnsubscribe = null;
    }

    if (!user) {
      handleSignedOut();
      return;
    }

    await handleSignedIn();
  });
}

function handleSignedOut() {
  clearUserMarksForLoggedOut();
  setAppLocked(true, "Googleログインしてください");
  finishInitialLoading();
}

async function handleSignedIn() {
  setAppLocked(false);

  await loadUserMarksFromCloud();
  subscribeUserMarksRealtime();

  resetWordDataAfterSignIn();
  await loadCurrentModeAfterSignIn();
}

function resetWordDataAfterSignIn() {
  allWordsByVol = createInitialWordsByVol();
  loadedVolumes = new Set();
  clearWordOrderCache();
  navClearNavigationHistory();
}

async function loadCurrentModeAfterSignIn() {
  if (currentMode === "favorites") {
    await handleLoadFavoritesMode();
    return;
  }

  if (currentMode === "difficults") {
    await handleLoadDifficultsMode();
    return;
  }

  await loadSheet(currentVol);
}

function clearUserMarksForLoggedOut() {
  favorites = {};
  difficults = {};
  favoritesUpdatedAt = 0;
  difficultsUpdatedAt = 0;
  favoritesVersion += 1;
  difficultsVersion += 1;
  clearWordOrderCache();
  requestListRebuild();
  render();
}

function setAppLocked(isLocked, message = "Googleログインしてください") {
  setControlsLocked(isLocked);

  if (!isLocked) {
    unlockAppUi();
    return;
  }

  lockAppUi(message);
}

function setControlsLocked(isLocked) {
  getLockableControls().forEach((control) => {
    if (!control) return;
    control.disabled = isLocked;
    control.classList.toggle("disabled", isLocked);
  });
}

function getLockableControls() {
  return [
    toggleSidebarBtnEl,
    favoriteListBtnEl,
    difficultListBtnEl,
    speechSyncBtnEl,
    challengeBtnEl,
    translationBtnEl,
    multipleChoiceBtnEl,
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
    reloadWordsBtnEl,
    ...volButtons
  ];
}

function unlockAppUi() {
  wordEl?.classList.remove("status-message");
  updateModeButtons();
  updateCurrentWordButtons();
  applySidebarState();
}

function lockAppUi(message) {
  allWordsByVol = createInitialWordsByVol();
  loadedVolumes = new Set();
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

  updateCurrentWordButtons();
  updateRandomButton();
  updateFrequencyButton();
}

function subscribeUserMarksRealtime() {
  if (!currentUser) return;

  userMarksUnsubscribe = subscribeUserMarksRealtimeRemote(db, USER_MARKS_COLLECTION, currentUser.uid, (snap) => {
    const { favoritesResult, difficultsResult } = resolveUserMarksSnapshot(snap, {
      favoritesUpdatedAt,
      difficultsUpdatedAt
    });

    if (!applyUserMarksResult({
      favoritesResult,
      difficultsResult,
      refreshLists: true
    })) return;

    render();
    scheduleSpeechSyncAfterRender();
    scheduleAutoPlayAfterRender();
  });
}

function applyUserMarksResult({ favoritesResult, difficultsResult, refreshLists = false }) {
  const favoritesChanged = Boolean(favoritesResult);
  const difficultsChanged = Boolean(difficultsResult);
  if (!favoritesChanged && !difficultsChanged) return false;

  if (favoritesChanged) {
    applyFavoritesCloudResult(favoritesResult);
  }

  if (difficultsChanged) {
    applyDifficultsCloudResult(difficultsResult);
  }

  if (refreshLists) {
    refreshUserMarkLists({ favoritesChanged, difficultsChanged });
  }

  return true;
}

function applyFavoritesCloudResult(result) {
  favorites = result.favorites;
  favoritesUpdatedAt = result.favoritesUpdatedAt;
  favoritesVersion += 1;

  saveFavoritesToLocalOnly(favorites);
  saveFavoritesUpdatedAt(favoritesUpdatedAt);
}

function applyDifficultsCloudResult(result) {
  difficults = result.difficults;
  difficultsUpdatedAt = result.difficultsUpdatedAt;
  difficultsVersion += 1;

  saveDifficultsToLocalOnly(difficults);
  saveDifficultsUpdatedAt(difficultsUpdatedAt);
}

function refreshUserMarkLists({ favoritesChanged, difficultsChanged }) {
  clearWordOrderCache();
  requestListRebuild();

  if (favoritesChanged && currentMode === "favorites") {
    applyWordOrder(false);
    index = clampWordIndex(index);
  }

  if (difficultsChanged && currentMode === "difficults") {
    applyWordOrder(false);
    index = clampWordIndex(index);
  }
}

async function loadUserMarksFromCloud() {
  if (!currentUser) return;

  try {
    const result = await syncUserMarksWithCloud(
      db,
      USER_MARKS_COLLECTION,
      currentUser.uid,
      getLocalUserMarksForSync()
    );

    applyUserMarksResult(createUserMarksResultFromSync(result));
  } catch (error) {
    console.error("クラウド読み込み失敗:", error);
  }
}

function getLocalUserMarksForSync() {
  return {
    favorites,
    favoritesUpdatedAt,
    difficults,
    difficultsUpdatedAt
  };
}

function createUserMarksResultFromSync(result) {
  return {
    favoritesResult: {
      favorites: result.favorites,
      favoritesUpdatedAt: result.favoritesUpdatedAt
    },
    difficultsResult: {
      difficults: result.difficults,
      difficultsUpdatedAt: result.difficultsUpdatedAt
    }
  };
}

async function saveFavoritesToCloud() {
  if (!currentUser) return;

  try {
    await saveFavoritesToCloudRemote(db, USER_MARKS_COLLECTION, currentUser.uid, favorites, favoritesUpdatedAt);
  } catch (error) {
    console.error("クラウド保存失敗:", error);
  }
}

async function saveDifficultsToCloud() {
  if (!currentUser) return;

  try {
    await saveDifficultsToCloudRemote(db, USER_MARKS_COLLECTION, currentUser.uid, difficults, difficultsUpdatedAt);
  } catch (error) {
    console.error("クラウド保存失敗:", error);
  }
}

async function ensureVolLoaded(volName) {
  if (loadedVolumes.has(volName)) return;

  allWordsByVol[volName] = await fetchWordsForVol(volName);
  loadedVolumes.add(volName);
}

function getReloadTargetVolumes() {
  if (currentMode === "favorites" || currentMode === "difficults") {
    return volOrder;
  }

  return [currentVol];
}

async function reloadWordsForVolumes(volumes) {
  const results = await Promise.all(
    volumes.map(async (volName) => [volName, await fetchWordsForVolWithMeta(volName)])
  );

  const wordsByVol = {};
  const metaByVol = {};

  results.forEach(([volName, result]) => {
    wordsByVol[volName] = result.words;
    metaByVol[volName] = result.meta;
  });

  return { wordsByVol, metaByVol };
}

function setReloadWordsStatus(message, options) {
  reloadWordsStatus.set(message, options);
}

function setReloadWordsInProgress(isLoading) {
  isReloadingWords = isLoading;
  if (!reloadWordsBtnEl) return;
  reloadWordsBtnEl.disabled = isLoading || !currentUser || wordEl?.classList.contains("status-message");
  reloadWordsBtnEl.classList.toggle("disabled", reloadWordsBtnEl.disabled);
  reloadWordsBtnEl.textContent = isLoading ? "同期中..." : "単語データ同期";
}

function resetMultipleChoiceState() {
  multipleChoiceQuestion = null;
  multipleChoiceAnswer = null;
  multipleChoiceRevealedOptionIndexes.clear();
}

async function handleReloadWords() {
  if (isReloadingWords) return;

  if (!currentUser) {
    setReloadWordsStatus("Googleログイン後に再読み込みできます");
    setReloadWordsInProgress(false);
    return;
  }

  const preserveWordId = getPreserveWordId(words, index);
  const previousIndex = index;
  const targetVolumes = getReloadTargetVolumes();

  if (isAutoPlayActive()) {
    stopAutoPlay();
  }

  setReloadWordsInProgress(true);
  setReloadWordsStatus("スプレッドシート同期中...");

  try {
    const sheetSyncResult = await syncSheetToFirestore({
      url: SHEET_SYNC_WEB_APP_URL,
      token: SHEET_SYNC_TOKEN
    });

    if (!sheetSyncResult.ok) {
      setReloadWordsStatus(`Apps Script同期に失敗しました: ${sheetSyncResult.error}`);
      return;
    }

    setReloadWordsStatus("Firestore再読み込み中...");
    const { wordsByVol: reloadedWordsByVol, metaByVol } = await reloadWordsForVolumes(targetVolumes);
    allWordsByVol = {
      ...allWordsByVol,
      ...reloadedWordsByVol
    };
    loadedVolumes = new Set([...loadedVolumes, ...targetVolumes]);
    clearWordOrderCache();
    resetMultipleChoiceState();
    applyWordOrder(false);
    index = getReloadedIndex({ words, previousIndex, preserveWordId });
    persistCurrentIndex();
    requestListRebuild();
    render();
    scheduleSpeechSyncAfterRender();
    const reloadMessage = formatReloadSuccessMessage({
      volumes: targetVolumes,
      wordsByVol: reloadedWordsByVol,
      metaByVol
    });
    const statusMessage = sheetSyncResult.skipped
      ? `${reloadMessage}。${sheetSyncResult.message}`
      : reloadMessage;
    setReloadWordsStatus(
      statusMessage,
      { clearAfterMs: 4000 }
    );
  } catch (error) {
    console.error("単語データの再読み込みに失敗しました:", error);
    setReloadWordsStatus("単語データの再読み込みに失敗しました");

    if (error?.code === "permission-denied") {
      setAppLocked(true, "このアプリは管理者のみ利用できます");
    }
  } finally {
    setReloadWordsInProgress(false);
  }
}

async function ensureAllVolumesLoaded() {
  const results = await Promise.allSettled(volOrder.map((vol) => ensureVolLoaded(vol)));
  handleVolumeLoadResults(results);
}

function handleVolumeLoadResults(results) {
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
    enterVolumeMode(volName);
    await ensureVolLoaded(volName);
    renderLoadedVolume(volName);
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

function enterVolumeMode(volName) {
  currentMode = "vol";
  currentVol = volName;
  navClearNavigationHistory();
  wordOrderUpdatePending = false;
  saveCurrentVol(currentVol);
  saveCurrentModeState(currentMode);
}

function renderLoadedVolume(volName) {
  clearWordOrderCache();
  applyWordOrder();
  index = clampWordIndex(indexByVol[volName] || 0);

  requestListRebuild();
  render();
  finishInitialLoading();
  scheduleSpeechSyncAfterRender();
  scheduleAutoPlayAfterRender();
}

async function preloadOtherVolumesInBackground() {
  const otherVols = volOrder.filter((vol) => vol !== currentVol);
  await Promise.all(otherVols.map((vol) => ensureVolLoaded(vol).catch(() => {})));
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
  const baseWords = getBaseWordsForCurrentMode();

  words = buildWordOrder({
    baseWords,
    currentMode,
    currentVol,
    randomMode,
    frequencyMode,
    orderCache: wordOrderCache,
    createFrequencyOrder: (items, options) => (
      sortByReviewScore(items, (item) => getReviewWeight(reviewScores, item), options)
    )
  });

  if (preserveCurrentId) {
    const preservedIndex = words.findIndex((item) => item && item.id === preserveCurrentId);
    index = preservedIndex >= 0 ? preservedIndex : clampWordIndex(index);
  } else {
    index = resetIndex ? 0 : clampWordIndex(index);
  }
}

function getBaseWordsForCurrentMode() {
  if (currentMode === "favorites") {
    return buildFavoriteEntries(allWordsByVol, volOrder, favorites);
  }

  if (currentMode === "difficults") {
    return buildDifficultEntries(allWordsByVol, volOrder, difficults);
  }

  return [...(allWordsByVol[currentVol] || [])];
}

function clampWordIndex(value) {
  return clampIndex(value, words);
}

function clearWordOrderCache() {
  wordOrderCache = {};
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

function runAfterNextPaint(callback) {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback);
  });
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

function updateMultipleChoiceButton() {
  uiUpdateMultipleChoiceButton(uiContext);
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

function updateModeButtons() {
  updateSpeechSyncButton();
  updateChallengeButton();
  updateTranslationButton();
  updateMultipleChoiceButton();
  updateAutoPlayButton();
  updateRandomButton();
  updateFrequencyButton();
}

function updateCurrentWordButtons() {
  updateFavoriteToggleButton();
  updateDifficultToggleButton();
  updateReviewButtons();
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
  speechSyncController.clearTimer();
}

function speakCurrentWordForSpeechSync() {
  speechSyncController.speakNow();
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

function shouldIgnoreAutoPlaySkipRequest(target) {
  return (
    !isAutoPlayActive() ||
    !words.length ||
    isAutoPlaySkipIgnoredTarget(target) ||
    isAutoPlaySkipLocked()
  );
}

function revealCurrentMeaningImmediately() {
  if (!meaningEl || meaningEl.textContent !== "\u30fb\u30fb\u30fb") return false;
  clearMeaningRevealTimer();
  meaningEl.textContent = getCurrentAnswerText();
  return true;
}

function scheduleAutoPlayToNext(delay) {
  clearAutoPlayTimer();
  markAutoPlayWaitStart();
  autoPlayTimer = setTimeout(() => {
    nextWord();
  }, delay);
}

function markAutoPlayWaitStart() {
  autoPlayWaitStartedAt = Date.now();
}

function handleAutoPlaySkipRequest(event) {
  if (shouldIgnoreAutoPlaySkipRequest(event.target)) return;

  if (challengeMode && revealCurrentMeaningImmediately()) {
    scheduleAutoPlayToNext(displayTime);
    return;
  }

  nextWord();
}

function scheduleAutoPlay() {
  if (!isAutoPlayActive() || !words.length) return;
  clearAutoPlayTimer();
  markAutoPlayWaitStart();

  if (challengeMode) {
    scheduleAutoPlayDisplayPhase();
  }

  autoPlayTimer = setTimeout(() => {
    nextWord();
  }, getAutoPlayDelay());
}

function scheduleAutoPlayDisplayPhase() {
  autoPlayDisplayPhaseTimer = setTimeout(() => {
    markAutoPlayWaitStart();
    autoPlayDisplayPhaseTimer = null;
  }, challengeTime);
}

function scheduleAutoPlayAfterRender() {
  if (!isAutoPlayActive()) return;
  runAfterNextPaint(scheduleAutoPlay);
}

function startAutoPlayFromCurrentWord() {
  scheduleAutoPlay();
}

function scheduleSpeechSync() {
  speechSyncController.schedule();
}

function scheduleSpeechSyncAfterRender() {
  speechSyncController.scheduleAfterRender();
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

function readWordItemIndex(item) {
  if (!(item instanceof HTMLElement)) return null;

  const itemIndex = Number(item.dataset.index);
  return Number.isNaN(itemIndex) ? null : itemIndex;
}

function moveToSearchResult(direction) {
  const resultItems = getSearchResultItems();
  if (!resultItems.length) return;

  const resultIndexes = resultItems
    .map(readWordItemIndex)
    .filter((itemIndex) => itemIndex !== null);
  const nextIndex = getNextSearchResultIndex({ resultIndexes, currentIndex: index, direction });
  if (nextIndex === null) return;

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
  speechSyncController.toggle();
}

function refreshCurrentWordAfterDisplaySettingChange() {
  if (isAutoPlayActive()) return;
  renderCurrentWord();
  scheduleSpeechSyncAfterRender();
}

function applyPendingWordOrderAsNext() {
  if (!wordOrderUpdatePending) return false;

  wordOrderUpdatePending = false;
  refreshWordOrderFromStart();
  persistCurrentIndex();
  return true;
}

function refreshWordOrderFromStart() {
  applyWordOrder(true);
  requestListRebuild();
  render();
  scheduleSpeechSyncAfterRender();
  scheduleAutoPlayAfterRender();
}

function toggleChallengeMode() {
  challengeMode = !challengeMode;
  saveChallengeModeState(challengeMode);
  updateChallengeButton();
  refreshCurrentWordAfterDisplaySettingChange();
}

function toggleTranslationMode() {
  translationMode = !translationMode;
  multipleChoiceQuestion = null;
  multipleChoiceAnswer = null;
  multipleChoiceRevealedOptionIndexes.clear();
  saveTranslationModeState(translationMode);
  updateTranslationButton();
  refreshCurrentWordAfterDisplaySettingChange();
}

function toggleMultipleChoiceMode() {
  multipleChoiceMode = !multipleChoiceMode;
  multipleChoiceQuestion = null;
  multipleChoiceAnswer = null;
  multipleChoiceRevealedOptionIndexes.clear();
  saveMultipleChoiceModeState(multipleChoiceMode);
  updateMultipleChoiceButton();

  if (multipleChoiceMode && isAutoPlayActive()) {
    stopAutoPlay();
  }

  renderCurrentWord();
}

function toggleAutoPlay() {
  autoPlayMode = autoPlayMode === "off" ? "once" : "off";
  updateAutoPlayOnceStartPoint();
  saveAutoPlayState(autoPlayMode);
  updateAutoPlayButton();

  if (!isAutoPlayActive()) {
    clearAutoPlayTimer();
    return;
  }

  speakCurrentWordForSpeechSync();
  startAutoPlayFromCurrentWord();
}

function updateAutoPlayOnceStartPoint() {
  autoPlayOnceStartPoint = autoPlayMode === "once" ? getAutoPlayPoint() : null;
}

function toggleRandomMode() {
  randomMode = !randomMode;
  saveRandomModeState(randomMode);
  updateRandomButton();
  finishWordOrderSettingChange();
}

function toggleFrequencyMode() {
  frequencyMode = !frequencyMode;
  saveFrequencyModeState(frequencyMode);
  updateFrequencyButton();
  finishWordOrderSettingChange();
}

function finishWordOrderSettingChange() {
  navClearNavigationHistory();
  clearWordOrderCache();

  if (isAutoPlayActive()) {
    wordOrderUpdatePending = true;
    return;
  }

  wordOrderUpdatePending = false;
  refreshWordOrderFromStart();
}

function prevWord() {
  moveRelativeWord(-1);
}

function nextWord() {
  moveRelativeWord(1, { stopAtAutoPlayStart: true });
}

function moveRelativeWord(direction, { stopAtAutoPlayStart = false } = {}) {
  if (!words.length) return;
  if (applyPendingWordOrderAsNext()) return;

  const historyIndex = direction < 0
    ? navGetRandomPrevIndexFromHistory()
    : navGetRandomNextIndexFromHistory();

  if (moveToRandomHistoryIndex(historyIndex)) return;

  const nextIndex = (index + direction + words.length) % words.length;
  if (stopAtAutoPlayStart && shouldStopAutoPlayOnce(nextIndex)) {
    stopAutoPlay();
    return;
  }

  moveToWordIndex(nextIndex);
}

function moveToRandomHistoryIndex(historyIndex) {
  if (!randomMode || historyIndex === null) return false;

  index = historyIndex;
  renderCurrentWord();
  scheduleSpeechSync();
  scheduleAutoPlay();
  persistCurrentIndex();
  return true;
}

function moveToWordIndex(nextIndex) {
  navMoveToIndex(nextIndex, { pushHistory: randomMode });
  scheduleAutoPlayAfterRender();
}

export { init, finishInitialLoading };
