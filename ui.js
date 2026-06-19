function getState(context) {
  return context.getState();
}

function getDom(context) {
  return context.dom;
}

function getCallbacks(context) {
  return context.callbacks;
}

export function renderApp(context, options = {}) {
  renderList(context);
  if (!options.skipCurrentWord) renderCurrentWord(context);
  updateCurrentLabel(context);
  updateTopButtons(context);
  updateRecallTimeControl(context);
  updateTranslationButton(context);
  updateMultipleChoiceButton(context);
  renderMultipleChoice(context);
  updateAutoPlayButton(context);
  updateRandomButton(context);
  updateFrequencyButton(context);
  if (options.skipCurrentWord) updateReviewButtons(context);
  applySidebarState(context);
}

function renderList(context) {
  const state = getState(context);
  const dom = getDom(context);
  const callbacks = getCallbacks(context);

  if (!dom.listEl) return;

  const nextVersion = getListRenderVersion(state);
  if (!state.listNeedsRebuild && state.renderedListVersion === nextVersion) {
    highlightActiveWord(context);
    return;
  }

  dom.listEl.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const visibleEntries = getVisibleWordEntries(state);

  if (visibleEntries.length === 0 && state.searchQuery) {
    fragment.appendChild(createEmptyResultRow());
  }

  visibleEntries.forEach(({ item, itemIndex }) => {
    fragment.appendChild(createWordListRow({ item, itemIndex, state, callbacks }));
  });

  dom.listEl.appendChild(fragment);
  callbacks.setListNeedsRebuild(false);
  callbacks.setRenderedListVersion(nextVersion);
  highlightActiveWord(context);
}

function createEmptyResultRow() {
  const row = document.createElement("div");
  row.className = "word-item empty-result";
  row.textContent = "該当なし";
  return row;
}

function createWordListRow({ item, itemIndex, state, callbacks }) {
  const row = document.createElement("div");
  row.className = "word-item";
  row.dataset.index = String(itemIndex);
  row.appendChild(createWordLabel(item, itemIndex, state));

  const marks = createWordMarks(item, callbacks);
  if (marks.childNodes.length) {
    row.appendChild(marks);
  }

  return row;
}

function createWordLabel(item, itemIndex, state) {
  const label = document.createElement("span");
  label.className = "word-label";

  if (!item) {
    label.textContent = "";
    console.warn("renderList: missing item at index", itemIndex);
    return label;
  }

  label.textContent = formatWordListLabel(item, state.currentMode);
  return label;
}

function formatWordListLabel(item, currentMode) {
  return currentMode === "favorites" || currentMode === "difficults"
    ? `${item.word} (${item.sourceVol.replace("vol", "vol.")})`
    : item.word;
}

function createWordMarks(item, callbacks) {
  const marks = document.createElement("span");
  marks.className = "item-marks";

  if (item && callbacks.isFavorite(item)) {
    marks.appendChild(createWordMark("item-star", "☆"));
  }

  if (item && callbacks.isDifficult(item)) {
    marks.appendChild(createWordMark("item-difficult", "△"));
  }

  return marks;
}

function createWordMark(className, text) {
  const mark = document.createElement("span");
  mark.className = className;
  mark.textContent = text;
  return mark;
}

function getVisibleWordEntries(state) {
  const query = normalizeSearchText(state.searchQuery);
  return state.words
    .map((item, itemIndex) => ({ item, itemIndex }))
    .filter(({ item }) => !query || matchesSearchQuery(item, query));
}

function matchesSearchQuery(item, query) {
  if (!item) return false;
  return [item.word, item.meaning, item.sourceVol]
    .map(normalizeSearchText)
    .some((value) => value.includes(query));
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function getListRenderVersion(state) {
  return `${state.currentMode}|${state.currentVol}|${state.randomMode ? 1 : 0}|${state.frequencyMode ? 1 : 0}|${state.listVersion}|${state.favoritesVersion}|${state.difficultsVersion}|${state.searchQuery}`;
}

export function renderCurrentWord(context) {
  const state = getState(context);
  const dom = getDom(context);
  const callbacks = getCallbacks(context);

  callbacks.clearMeaningRevealTimer();
  callbacks.clearSpeechSyncTimer();

  const current = callbacks.getCurrentWord();
  if (!current) {
    renderEmptyCurrentWord(context);
    return;
  }

  renderWordText(context, current);
  updateMeaningDisplay(context, state.translationMode ? current.word : current.meaning);
  renderMultipleChoice(context);
  updateCurrentStateMeta(context);
  if (state.multipleChoiceMode) {
    if (dom.pronunciationEl) dom.pronunciationEl.textContent = "";
  } else {
    callbacks.loadPronunciation(current.word);
  }
}

function renderEmptyCurrentWord(context) {
  const state = getState(context);
  const dom = getDom(context);

  if (dom.wordEl) dom.wordEl.textContent = getEmptyWordText(state.currentMode);
  if (dom.meaningEl) dom.meaningEl.textContent = getEmptyMeaningText(state.currentMode);
  if (dom.progressEl) dom.progressEl.textContent = "";
  if (dom.pronunciationEl) dom.pronunciationEl.textContent = "";
  if (dom.prevHintEl) dom.prevHintEl.textContent = "";
  if (dom.nextHintEl) dom.nextHintEl.textContent = "";
  renderMultipleChoice(context);

  updateFavoriteToggleButton(context);
  updateDifficultToggleButton(context);
  updateReviewButtons(context);
}

function getEmptyWordText(currentMode) {
  if (currentMode === "favorites") return "お気に入りがありません";
  if (currentMode === "difficults") return "苦手単語がありません";
  return "単語がありません";
}

function getEmptyMeaningText(currentMode) {
  if (currentMode === "favorites") return "☆を付けるとここに表示されます";
  if (currentMode === "difficults") return "△を付けるとここに表示されます";
  return "";
}

function renderWordText(context, current) {
  const state = getState(context);
  const dom = getDom(context);
  if (dom.wordEl) dom.wordEl.textContent = state.translationMode ? current.meaning : current.word;
}

function updateCurrentStateMeta(context) {
  const callbacks = getCallbacks(context);

  callbacks.persistCurrentIndex();
  const activeItem = highlightActiveWord(context);
  scrollActiveWordIntoView(context, activeItem);
  updateNavHints(context);
  updateFavoriteToggleButton(context);
  updateDifficultToggleButton(context);
  updateReviewButtons(context);
  updateProgress(context);
}

export function updateCurrentLabel(context) {
  const state = getState(context);
  const dom = getDom(context);

  if (!dom.currentEl) return;
  dom.currentEl.textContent = getCurrentModeLabel(state);
}

function getCurrentModeLabel(state) {
  if (state.currentMode === "favorites") return "☆";
  if (state.currentMode === "difficults") return "△";
  return `vol.${state.currentVol.replace("vol", "")}`;
}

function updateTopButtons(context) {
  const state = getState(context);
  const dom = getDom(context);

  dom.volButtons.forEach((button) => {
    const isActive = state.currentMode === "vol" && button.dataset.vol === state.currentVol;
    button.classList.toggle("active-vol", isActive);
  });

  if (dom.favoriteListBtnEl) {
    dom.favoriteListBtnEl.classList.toggle("active-vol", state.currentMode === "favorites");
  }

  if (dom.difficultListBtnEl) {
    dom.difficultListBtnEl.classList.toggle("active-vol", state.currentMode === "difficults");
  }
}

function updateToggleButton(context, button, label, isActive) {
  if (!button) return;
  button.textContent = label;
  button.classList.toggle("active", isActive);
  button.classList.toggle("active-blue", isActive);
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
}

export function updateFavoriteToggleButton(context) {
  const dom = getDom(context);
  const callbacks = getCallbacks(context);
  const state = context.getState();
  const current = callbacks.getCurrentWord();

  updateWordMarkToggleButton({
    button: dom.favoriteToggleBtnEl,
    current,
    currentUser: state.currentUser,
    symbol: "☆",
    inactiveLabel: "お気に入り登録",
    activeLabel: "お気に入り解除",
    loggedOutLabel: "ログインするとお気に入り登録できます",
    isActive: callbacks.isFavorite
  });
}

export function updateDifficultToggleButton(context) {
  const dom = getDom(context);
  const callbacks = getCallbacks(context);
  const state = context.getState();
  const current = callbacks.getCurrentWord();

  updateWordMarkToggleButton({
    button: dom.difficultToggleBtnEl,
    current,
    currentUser: state.currentUser,
    symbol: "△",
    inactiveLabel: "苦手に追加",
    activeLabel: "苦手から外す",
    loggedOutLabel: "ログインすると苦手に追加できます",
    isActive: callbacks.isDifficult
  });
}

function updateWordMarkToggleButton({
  button,
  current,
  currentUser,
  symbol,
  inactiveLabel,
  activeLabel,
  loggedOutLabel,
  isActive
}) {
  if (!button) return;

  button.textContent = symbol;

  if (!current || !currentUser) {
    const label = currentUser ? inactiveLabel : loggedOutLabel;
    button.disabled = true;
    button.classList.remove("active");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "false");
    return;
  }

  const active = isActive(current);
  const label = active ? activeLabel : inactiveLabel;

  button.disabled = false;
  button.classList.toggle("active", active);
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", active ? "true" : "false");
}

export function updateReviewButtons(context) {
  const dom = getDom(context);
  const callbacks = getCallbacks(context);
  const current = callbacks.getCurrentWord();

  if (!dom.decreaseReviewBtnEl || !dom.resetReviewBtnEl || !dom.increaseReviewBtnEl) return;

  if (!current) {
    if (dom.reviewScoreLabelEl) dom.reviewScoreLabelEl.textContent = "頻度調整：-";
    setReviewButtonState(dom.decreaseReviewBtnEl, true, "頻度調整：-");
    setReviewButtonState(dom.resetReviewBtnEl, true, "頻度調整：-");
    setReviewButtonState(dom.increaseReviewBtnEl, true, "頻度調整：-");
    return;
  }

  const score = callbacks.getReviewScore(current);
  const label = `頻度調整：${score}`;
  if (dom.reviewScoreLabelEl) dom.reviewScoreLabelEl.textContent = label;
  setReviewButtonState(dom.decreaseReviewBtnEl, false, label);
  setReviewButtonState(dom.resetReviewBtnEl, false, "頻度調整を0に戻す");
  setReviewButtonState(dom.increaseReviewBtnEl, false, label);
}

function setReviewButtonState(button, disabled, label) {
  button.disabled = disabled;
  button.classList.remove("active");
  button.setAttribute("aria-pressed", "false");
  button.title = label;
}

function updateNavHints(context) {
  const state = getState(context);
  const dom = getDom(context);

  if (!dom.prevHintEl || !dom.nextHintEl) return;
  if (!state.words.length) {
    dom.prevHintEl.textContent = "";
    dom.nextHintEl.textContent = "";
    return;
  }

  const prevIndex = getPreviousHintIndex(state);
  const nextIndex = getNextHintIndex(state);
  dom.prevHintEl.textContent = state.words[prevIndex]?.word || "";
  dom.nextHintEl.textContent = state.words[nextIndex]?.word || "";
}

function getPreviousHintIndex(state) {
  if (state.randomMode && state.historyBackStack.length) {
    return state.historyBackStack[state.historyBackStack.length - 1];
  }

  return (state.index - 1 + state.words.length) % state.words.length;
}

function getNextHintIndex(state) {
  if (state.randomMode && state.historyForwardStack.length) {
    return state.historyForwardStack[state.historyForwardStack.length - 1];
  }

  return (state.index + 1) % state.words.length;
}

function updateProgress(context) {
  const state = getState(context);
  const dom = getDom(context);

  if (!dom.progressEl) return;

  const total = state.words.length;
  const current = total === 0 ? 0 : state.index + 1;
  dom.progressEl.textContent = `${current} / ${total}`;
}

export function updateRecallTimeControl(context) {
  const state = getState(context);
  const dom = getDom(context);
  dom.recallTimeControlEl?.classList.toggle("is-inactive", !state.challengeMode);
  dom.displayTimeControlEl?.classList.toggle("is-inactive", state.autoPlayMode === "off");
}

export function updateSpeechSyncButton(context) {
  updateToggleButton(context, getDom(context).speechSyncBtnEl, "発音同期", getState(context).speechSync);
}

export function updateChallengeButton(context) {
  updateToggleButton(context, getDom(context).challengeBtnEl, "想起学習", getState(context).challengeMode);
}

export function updateTranslationButton(context) {
  updateToggleButton(context, getDom(context).translationBtnEl, "訳語切替", getState(context).translationMode);
}

export function updateMultipleChoiceButton(context) {
  updateToggleButton(context, getDom(context).multipleChoiceBtnEl, "四択問題", getState(context).multipleChoiceMode);
}

export function updateAutoPlayButton(context) {
  const state = getState(context);
  const isActive = state.autoPlayMode === "once";
  const label = isActive ? "一周再生" : "自動再生";
  updateToggleButton(context, getDom(context).autoPlayBtnEl, label, isActive);
}

export function updateRandomButton(context) {
  updateToggleButton(context, getDom(context).randomBtnEl, "乱数配列", getState(context).randomMode);
}

export function updateFrequencyButton(context) {
  updateToggleButton(context, getDom(context).frequencyBtnEl, "頻度配列", getState(context).frequencyMode);
}

export function updateAuthUI(context) {
  const dom = getDom(context);
  const state = getState(context);

  if (!dom.loginBtnEl || !dom.logoutBtnEl) return;

  dom.loginBtnEl.hidden = Boolean(state.currentUser);
  dom.logoutBtnEl.hidden = !state.currentUser;
}

export function renderMultipleChoice(context) {
  const state = getState(context);
  const dom = getDom(context);
  const callbacks = getCallbacks(context);

  if (!dom.multipleChoicePanelEl || !dom.multipleChoiceOptionsEl) return;

  if (typeof document !== "undefined") {
    document.body.classList.toggle("mode-multiple-choice", state.multipleChoiceMode);
  }

  dom.multipleChoicePanelEl.hidden = !state.multipleChoiceMode;
  if (!state.multipleChoiceMode) {
    dom.multipleChoiceOptionsEl.innerHTML = "";
    if (dom.multipleChoiceQuestionEl) dom.multipleChoiceQuestionEl.textContent = "";
    if (dom.multipleChoiceFeedbackEl) dom.multipleChoiceFeedbackEl.textContent = "";
    return;
  }

  const question = callbacks.getMultipleChoiceQuestion?.();
  if (!question) {
    dom.multipleChoiceOptionsEl.innerHTML = "";
    if (dom.multipleChoiceQuestionEl) dom.multipleChoiceQuestionEl.textContent = "選択肢を作成できません";
    if (dom.multipleChoiceFeedbackEl) dom.multipleChoiceFeedbackEl.textContent = "";
    return;
  }
  const latestState = getState(context);

  if (dom.multipleChoiceQuestionEl) {
    dom.multipleChoiceQuestionEl.textContent = "";
  }

  dom.multipleChoiceOptionsEl.innerHTML = "";
  question.options.forEach((option, optionIndex) => {
    const isAnswered = Boolean(latestState.multipleChoiceAnswer);
    const isRevealed = isAnswered &&
      !option.isCorrect &&
      latestState.multipleChoiceRevealedOptionIndexes?.includes(optionIndex);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "multiple-choice-option";
    button.textContent = isRevealed && option.secondaryText ? option.secondaryText : option.text;
    button.dataset.choiceIndex = String(optionIndex);

    if (isAnswered) {
      if (option.text === latestState.multipleChoiceAnswer.correctText) {
        button.classList.add("is-correct");
      }
      if (
        option.text === latestState.multipleChoiceAnswer.selectedText &&
        !latestState.multipleChoiceAnswer.isCorrect
      ) {
        button.classList.add("is-wrong");
      }
    }

    dom.multipleChoiceOptionsEl.appendChild(button);
  });

  if (dom.multipleChoiceFeedbackEl) {
    dom.multipleChoiceFeedbackEl.textContent = "";
  }
}
function updateMeaningDisplay(context, meaning) {
  const state = getState(context);
  const dom = getDom(context);
  const callbacks = getCallbacks(context);

  if (!dom.meaningEl) return;
  callbacks.clearMeaningRevealTimer();

  if (state.multipleChoiceMode) {
    dom.meaningEl.textContent = "";
    return;
  }

  if (!state.challengeMode) {
    dom.meaningEl.textContent = meaning;
    return;
  }

  dom.meaningEl.textContent = "・・・";
  callbacks.setMeaningRevealTimer(setTimeout(() => {
    dom.meaningEl.textContent = meaning;
  }, state.challengeTime));
}

function highlightActiveWord(context) {
  const state = getState(context);
  const dom = getDom(context);

  const currentActive = dom.listEl?.querySelector(".word-item.active");
  const nextActive = dom.listEl?.querySelector(`.word-item[data-index="${state.index}"]`);

  if (currentActive && currentActive !== nextActive) {
    currentActive.classList.remove("active");
  }
  if (nextActive) {
    nextActive.classList.add("active");
  }
  return nextActive || null;
}

function scrollActiveWordIntoView(context, activeItem) {
  if (!activeItem) return;

  activeItem.scrollIntoView({
    block: "center",
    behavior: "auto"
  });
}

export function applySidebarState(context) {
  const state = getState(context);
  const dom = getDom(context);

  if (!dom.sidebarEl) return;
  dom.sidebarEl.classList.toggle("hidden", !state.sidebarOpen);
  dom.toggleSidebarBtnEl?.classList.toggle("active", state.sidebarOpen);
  dom.toggleSidebarBtnEl?.setAttribute("aria-expanded", String(state.sidebarOpen));
}

export function clearMeaningRevealTimer(context) {
  const callbacks = getCallbacks(context);
  callbacks.clearMeaningRevealTimer();
}

