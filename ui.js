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
  updateAutoPlayButton(context);
  updateRandomButton(context);
  updateFrequencyButton(context);
  if (options.skipCurrentWord) updateReviewButtons(context);
  applySidebarState(context);
}

export function renderList(context) {
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
    const row = document.createElement("div");
    row.className = "word-item empty-result";
    row.textContent = "該当なし";
    fragment.appendChild(row);
  }

  visibleEntries.forEach(({ item, itemIndex }) => {
    const row = document.createElement("div");
    row.className = "word-item";
    row.dataset.index = String(itemIndex);

    const label = document.createElement("span");
    label.className = "word-label";
    if (!item) {
      label.textContent = "";
      console.warn('renderList: missing item at index', itemIndex);
    } else {
      label.textContent = state.currentMode === "favorites" || state.currentMode === "difficults"
        ? `${item.word} (${item.sourceVol.replace("vol", "vol.")})`
        : item.word;
    }
    row.appendChild(label);

    const marks = document.createElement("span");
    marks.className = "item-marks";

    if (item && callbacks.isFavorite(item)) {
      const star = document.createElement("span");
      star.className = "item-star";
      star.textContent = "☆";
      marks.appendChild(star);
    }

    if (item && callbacks.isDifficult(item)) {
      const difficult = document.createElement("span");
      difficult.className = "item-difficult";
      difficult.textContent = "△";
      marks.appendChild(difficult);
    }

    if (marks.childNodes.length) {
      row.appendChild(marks);
    }

    fragment.appendChild(row);
  });

  dom.listEl.appendChild(fragment);
  callbacks.setListNeedsRebuild(false);
  callbacks.setRenderedListVersion(nextVersion);
  highlightActiveWord(context);
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
    if (dom.wordEl) {
      dom.wordEl.textContent = state.currentMode === "favorites"
        ? "お気に入りがありません"
        : state.currentMode === "difficults"
          ? "苦手単語がありません"
          : "単語がありません";
    }
    if (dom.meaningEl) {
      dom.meaningEl.textContent = state.currentMode === "favorites"
        ? "☆を付けるとここに表示されます"
        : state.currentMode === "difficults"
          ? "△を付けるとここに表示されます"
          : "";
    }
    if (dom.progressEl) dom.progressEl.textContent = "";
    if (dom.pronunciationEl) dom.pronunciationEl.textContent = "";
    if (dom.prevHintEl) dom.prevHintEl.textContent = "";
    if (dom.nextHintEl) dom.nextHintEl.textContent = "";
    updateFavoriteToggleButton(context);
    updateDifficultToggleButton(context);
    updateReviewButtons(context);
    return;
  }

  renderWordText(context, current);
  updateMeaningDisplay(context, state.translationMode ? current.word : current.meaning);
  updateCurrentStateMeta(context);
  callbacks.loadPronunciation(current.word);
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

  let label = state.currentMode === "favorites"
    ? "☆"
    : state.currentMode === "difficults"
      ? "△"
      : `vol.${state.currentVol.replace("vol", "")}`;



  dom.currentEl.textContent = label;
}

export function updateTopButtons(context) {
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

export function updateToggleButton(context, button, label, isActive) {
  if (!button) return;
  button.textContent = label;
  button.classList.toggle("active", isActive);
  button.classList.toggle("active-blue", isActive);
  button.setAttribute("aria-pressed", isActive ? "true" : "false");
}

export function updateFavoriteToggleButton(context) {
  const dom = getDom(context);
  const callbacks = getCallbacks(context);
  const current = callbacks.getCurrentWord();
  if (!dom.favoriteToggleBtnEl) return;

  if (!current) {
    dom.favoriteToggleBtnEl.textContent = "☆";
    dom.favoriteToggleBtnEl.classList.remove("active");
    dom.favoriteToggleBtnEl.title = "お気に入り登録";
    dom.favoriteToggleBtnEl.setAttribute("aria-label", "お気に入り登録");
    dom.favoriteToggleBtnEl.setAttribute("aria-pressed", "false");
    dom.favoriteToggleBtnEl.disabled = true;
    return;
  }

  dom.favoriteToggleBtnEl.disabled = false;

  const active = callbacks.isFavorite(current);
  dom.favoriteToggleBtnEl.textContent = "☆";
  dom.favoriteToggleBtnEl.classList.toggle("active", active);
  dom.favoriteToggleBtnEl.title = active ? "お気に入り解除" : "お気に入り登録";
  dom.favoriteToggleBtnEl.setAttribute("aria-label", active ? "お気に入り解除" : "お気に入り登録");
  dom.favoriteToggleBtnEl.setAttribute("aria-pressed", active ? "true" : "false");
}

export function updateDifficultToggleButton(context) {
  const dom = getDom(context);
  const callbacks = getCallbacks(context);
  const current = callbacks.getCurrentWord();
  if (!dom.difficultToggleBtnEl) return;

  if (!current) {
    dom.difficultToggleBtnEl.textContent = "△";
    dom.difficultToggleBtnEl.classList.remove("active");
    dom.difficultToggleBtnEl.title = "苦手に追加";
    dom.difficultToggleBtnEl.setAttribute("aria-label", "苦手に追加");
    dom.difficultToggleBtnEl.setAttribute("aria-pressed", "false");
    dom.difficultToggleBtnEl.disabled = true;
    return;
  }

  dom.difficultToggleBtnEl.disabled = false;

  const active = callbacks.isDifficult(current);
  dom.difficultToggleBtnEl.textContent = "△";
  dom.difficultToggleBtnEl.classList.toggle("active", active);
  dom.difficultToggleBtnEl.title = active ? "苦手から外す" : "苦手に追加";
  dom.difficultToggleBtnEl.setAttribute("aria-label", active ? "苦手から外す" : "苦手に追加");
  dom.difficultToggleBtnEl.setAttribute("aria-pressed", active ? "true" : "false");
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
export function updateNavHints(context) {
  const state = getState(context);
  const dom = getDom(context);

  if (!dom.prevHintEl || !dom.nextHintEl) return;
  if (!state.words.length) {
    dom.prevHintEl.textContent = "";
    dom.nextHintEl.textContent = "";
    return;
  }

  const prevIndex = state.randomMode && state.historyBackStack.length
    ? state.historyBackStack[state.historyBackStack.length - 1]
    : (state.index - 1 + state.words.length) % state.words.length;

  const nextIndex = state.randomMode && state.historyForwardStack.length
    ? state.historyForwardStack[state.historyForwardStack.length - 1]
    : (state.index + 1) % state.words.length;

  dom.prevHintEl.textContent = state.words[prevIndex]?.word || "";
  dom.nextHintEl.textContent = state.words[nextIndex]?.word || "";
}

export function updateProgress(context) {
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

export function updateAutoPlayButton(context) {
  const state = getState(context);
  const label = state.autoPlayMode === "once"
    ? "一周再生"
    : state.autoPlayMode === "loop"
      ? "循環再生"
      : "自動再生";
  updateToggleButton(context, getDom(context).autoPlayBtnEl, label, state.autoPlayMode !== "off");
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

export function updateMeaningDisplay(context, meaning) {
  const state = getState(context);
  const dom = getDom(context);
  const callbacks = getCallbacks(context);

  if (!dom.meaningEl) return;
  callbacks.clearMeaningRevealTimer();

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
