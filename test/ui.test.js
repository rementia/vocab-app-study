import assert from "assert";
import {
  renderCurrentWord,
  renderMultipleChoice,
  updateAuthUI,
  updateAutoPlayButton,
  updateCurrentLabel,
  updateDifficultToggleButton,
  updateFavoriteToggleButton,
  updateRecallTimeControl,
  updateReviewButtons
} from "../ui.js";

function makeContext(currentUser) {
  return {
    getState: () => ({ currentUser }),
    dom: {
      loginBtnEl: { hidden: true },
      logoutBtnEl: { hidden: false }
    },
    callbacks: {}
  };
}

let context = makeContext(null);
updateAuthUI(context);
assert.strictEqual(context.dom.loginBtnEl.hidden, false);
assert.strictEqual(context.dom.logoutBtnEl.hidden, true);

context = makeContext({ uid: "user-1" });
updateAuthUI(context);
assert.strictEqual(context.dom.loginBtnEl.hidden, true);
assert.strictEqual(context.dom.logoutBtnEl.hidden, false);

const labelContext = {
  dom: { currentEl: { textContent: "" } },
  getState: () => ({
    currentMode: "normal",
    currentVol: "vol4"
  })
};
updateCurrentLabel(labelContext);
assert.strictEqual(labelContext.dom.currentEl.textContent, "vol.4");

function makeButton() {
  return {
    disabled: false,
    title: "",
    attributes: {},
    classList: { remove() {} },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

function makeToggleButton() {
  return {
    disabled: false,
    textContent: "",
    title: "",
    attributes: {},
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      },
      remove(name) {
        this.values.delete(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

const favoriteButton = makeToggleButton();
const difficultButton = makeToggleButton();
const loggedOutToggleContext = {
  getState: () => ({ currentUser: null }),
  dom: {
    favoriteToggleBtnEl: favoriteButton,
    difficultToggleBtnEl: difficultButton
  },
  callbacks: {
    getCurrentWord: () => ({ id: "word-1", word: "create" }),
    isFavorite: () => true,
    isDifficult: () => true
  }
};
updateFavoriteToggleButton(loggedOutToggleContext);
updateDifficultToggleButton(loggedOutToggleContext);
assert.strictEqual(favoriteButton.disabled, true, "favorite toggle should be disabled when logged out");
assert.strictEqual(difficultButton.disabled, true, "difficult toggle should be disabled when logged out");
assert.strictEqual(favoriteButton.attributes["aria-pressed"], "false");
assert.strictEqual(difficultButton.attributes["aria-pressed"], "false");

const autoPlayButton = makeToggleButton();
const autoPlayContext = (autoPlayMode) => ({
  getState: () => ({ autoPlayMode }),
  dom: { autoPlayBtnEl: autoPlayButton }
});
updateAutoPlayButton(autoPlayContext("off"));
assert.strictEqual(autoPlayButton.textContent, "自動再生");
assert.strictEqual(autoPlayButton.attributes["aria-pressed"], "false");
updateAutoPlayButton(autoPlayContext("once"));
assert.strictEqual(autoPlayButton.textContent, "一周再生");
assert.strictEqual(autoPlayButton.attributes["aria-pressed"], "true");
updateAutoPlayButton(autoPlayContext("loop"));
assert.strictEqual(autoPlayButton.textContent, "自動再生");
assert.strictEqual(autoPlayButton.attributes["aria-pressed"], "false");

function makeClassList() {
  return {
    values: new Set(),
    toggle(name, force) {
      if (force) this.values.add(name);
      else this.values.delete(name);
    },
    contains(name) {
      return this.values.has(name);
    }
  };
}

const recallClassList = makeClassList();
const displayClassList = makeClassList();
const timeControlContext = (challengeMode, autoPlayMode) => ({
  getState: () => ({ challengeMode, autoPlayMode }),
  dom: {
    recallTimeControlEl: { classList: recallClassList },
    displayTimeControlEl: { classList: displayClassList }
  }
});

updateRecallTimeControl(timeControlContext(false, "off"));
assert.strictEqual(recallClassList.contains("is-inactive"), true, "recall time should dim when challenge mode is off");
assert.strictEqual(displayClassList.contains("is-inactive"), true, "display time should dim when auto play is off");

updateRecallTimeControl(timeControlContext(true, "once"));
assert.strictEqual(recallClassList.contains("is-inactive"), false, "recall time should be active when challenge mode is on");
assert.strictEqual(displayClassList.contains("is-inactive"), false, "display time should be active when auto play is on");
updateRecallTimeControl(timeControlContext(false, "once"));
assert.strictEqual(recallClassList.contains("is-inactive"), true, "recall time should dim when challenge mode is off even during auto play");
assert.strictEqual(displayClassList.contains("is-inactive"), false, "display time should stay active when auto play is on and challenge mode is off");

const reviewWords = [{ id: "word-1" }, { id: "word-2" }];
let reviewIndex = 0;
const reviewContext = {
  dom: {
    reviewScoreLabelEl: { textContent: "" },
    decreaseReviewBtnEl: makeButton(),
    resetReviewBtnEl: makeButton(),
    increaseReviewBtnEl: makeButton()
  },
  callbacks: {
    getCurrentWord: () => reviewWords[reviewIndex],
    getReviewScore: (item) => item.id === "word-1" ? 2 : -1
  }
};

updateReviewButtons(reviewContext);
assert.strictEqual(reviewContext.dom.reviewScoreLabelEl.textContent, "頻度調整：2");
assert.strictEqual(reviewContext.dom.decreaseReviewBtnEl.title, "頻度調整：2");
assert.strictEqual(reviewContext.dom.increaseReviewBtnEl.title, "頻度調整：2");
assert.strictEqual(reviewContext.dom.resetReviewBtnEl.title, "頻度調整を0に戻す");

function makeWordContext(translationMode) {
  return {
    getState: () => ({
      words: [{ word: "create", meaning: "作る" }],
      index: 0,
      currentMode: "vol",
      currentVol: "vol1",
      translationMode,
      challengeMode: false,
      challengeTime: 1500,
      randomMode: false,
      historyBackStack: [],
      historyForwardStack: []
    }),
    dom: {
      wordEl: { textContent: "" },
      meaningEl: { textContent: "" },
      progressEl: { textContent: "" },
      listEl: { querySelector: () => null },
      favoriteToggleBtnEl: null,
      difficultToggleBtnEl: null,
      decreaseReviewBtnEl: null,
      resetReviewBtnEl: null,
      increaseReviewBtnEl: null,
      prevHintEl: null,
      nextHintEl: null
    },
    callbacks: {
      clearMeaningRevealTimer() {},
      clearSpeechSyncTimer() {},
      clearAutoPlayTimer() {},
      getCurrentWord: () => ({ word: "create", meaning: "作る" }),
      persistCurrentIndex() {},
      loadPronunciation() {},
      isFavorite: () => false,
      isDifficult: () => false,
      getReviewScore: () => 0
    }
  };
}

const normalWordContext = makeWordContext(false);
renderCurrentWord(normalWordContext);
assert.strictEqual(normalWordContext.dom.wordEl.textContent, "create");
assert.strictEqual(normalWordContext.dom.meaningEl.textContent, "作る");

const translatedWordContext = makeWordContext(true);
renderCurrentWord(translatedWordContext);
assert.strictEqual(translatedWordContext.dom.wordEl.textContent, "作る");
assert.strictEqual(translatedWordContext.dom.meaningEl.textContent, "create");

reviewIndex = 1;
updateReviewButtons(reviewContext);
assert.strictEqual(reviewContext.dom.reviewScoreLabelEl.textContent, "頻度調整：-1");
assert.strictEqual(reviewContext.dom.decreaseReviewBtnEl.title, "頻度調整：-1");
assert.strictEqual(reviewContext.dom.increaseReviewBtnEl.title, "頻度調整：-1");


function makeMockClassList() {
  return {
    values: new Set(),
    add(name) {
      this.values.add(name);
    },
    remove(name) {
      this.values.delete(name);
    },
    toggle(name, force) {
      if (force) this.values.add(name);
      else this.values.delete(name);
    },
    contains(name) {
      return this.values.has(name);
    }
  };
}

function makeMockElement() {
  const element = {
    _innerHTML: "",
    textContent: "",
    hidden: false,
    type: "",
    dataset: {},
    children: [],
    classList: makeMockClassList(),
    set className(value) {
      this._className = value;
      this.classList.values = new Set(String(value).split(/\s+/).filter(Boolean));
    },
    get className() {
      return this._className || "";
    },
    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
    },
    get innerHTML() {
      return this._innerHTML;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    }
  };
  return element;
}

globalThis.document = {
  body: { classList: makeMockClassList() },
  createElement: () => makeMockElement()
};

function makeMultipleChoiceDom() {
  return {
    wordEl: makeMockElement(),
    meaningEl: makeMockElement(),
    progressEl: makeMockElement(),
    pronunciationEl: makeMockElement(),
    multipleChoicePanelEl: makeMockElement(),
    multipleChoiceQuestionEl: makeMockElement(),
    multipleChoiceOptionsEl: makeMockElement(),
    multipleChoiceFeedbackEl: makeMockElement(),
    listEl: { querySelector: () => null },
    favoriteToggleBtnEl: null,
    difficultToggleBtnEl: null,
    decreaseReviewBtnEl: null,
    resetReviewBtnEl: null,
    increaseReviewBtnEl: null,
    prevHintEl: null,
    nextHintEl: null
  };
}

const multipleChoiceOptions = [
  { text: "abandon", secondaryText: "捨てる", isCorrect: true },
  { text: "expand", secondaryText: "拡大する", isCorrect: false },
  { text: "permit", secondaryText: "許可する", isCorrect: false },
  { text: "protect", secondaryText: "保護する", isCorrect: false }
];

function makeMultipleChoiceContext(overrides = {}) {
  const dom = makeMultipleChoiceDom();
  const state = {
    words: [{ word: "abandon", meaning: "捨てる" }],
    index: 0,
    currentMode: "vol",
    currentVol: "vol1",
    translationMode: false,
    challengeMode: false,
    challengeTime: 1500,
    randomMode: false,
    historyBackStack: [],
    historyForwardStack: [],
    multipleChoiceMode: false,
    multipleChoiceAnswer: null,
    multipleChoiceRevealedOptionIndexes: [],
    ...overrides
  };
  return {
    dom,
    getState: () => state,
    callbacks: {
      clearMeaningRevealTimer() {},
      clearSpeechSyncTimer() {},
      clearAutoPlayTimer() {},
      getCurrentWord: () => ({ word: "abandon", meaning: "捨てる" }),
      getMultipleChoiceQuestion: () => ({ options: multipleChoiceOptions }),
      persistCurrentIndex() {},
      loadPronunciation() {},
      isFavorite: () => false,
      isDifficult: () => false,
      getReviewScore: () => 0
    }
  };
}

const inactiveChoiceContext = makeMultipleChoiceContext({ multipleChoiceMode: false });
renderMultipleChoice(inactiveChoiceContext);
assert.strictEqual(inactiveChoiceContext.dom.multipleChoicePanelEl.hidden, true, "multiple choice panel should be hidden when mode is off");
assert.strictEqual(inactiveChoiceContext.dom.multipleChoiceOptionsEl.children.length, 0, "multiple choice options should be cleared when mode is off");

const activeChoiceContext = makeMultipleChoiceContext({ multipleChoiceMode: true });
renderCurrentWord(activeChoiceContext);
assert.strictEqual(activeChoiceContext.dom.wordEl.textContent, "abandon", "multiple choice question should be shown as the current word");
assert.strictEqual(activeChoiceContext.dom.meaningEl.textContent, "", "normal meaning should be hidden in multiple choice mode");
assert.strictEqual(activeChoiceContext.dom.multipleChoicePanelEl.hidden, false, "multiple choice panel should be visible when mode is on");
assert.strictEqual(activeChoiceContext.dom.multipleChoiceOptionsEl.children.length, 4, "multiple choice mode should render four option buttons");
assert.deepStrictEqual(
  activeChoiceContext.dom.multipleChoiceOptionsEl.children.map((button) => button.textContent),
  ["abandon", "expand", "permit", "protect"]
);
assert.strictEqual(activeChoiceContext.dom.multipleChoiceFeedbackEl.textContent, "", "multiple choice should not show text feedback before answering");

const correctChoiceContext = makeMultipleChoiceContext({
  multipleChoiceMode: true,
  multipleChoiceAnswer: { selectedText: "abandon", correctText: "abandon", isCorrect: true }
});
renderMultipleChoice(correctChoiceContext);
const correctButtons = correctChoiceContext.dom.multipleChoiceOptionsEl.children;
assert.strictEqual(correctChoiceContext.dom.multipleChoiceFeedbackEl.textContent, "", "correct answer should not show text feedback");
assert.strictEqual(correctButtons[0].classList.contains("is-correct"), true, "correct option should get correct class");
assert.strictEqual(correctButtons[0].classList.contains("is-wrong"), false, "correct option should not get wrong class");

const wrongChoiceContext = makeMultipleChoiceContext({
  multipleChoiceMode: true,
  multipleChoiceAnswer: { selectedText: "expand", correctText: "abandon", isCorrect: false }
});
renderMultipleChoice(wrongChoiceContext);
const wrongButtons = wrongChoiceContext.dom.multipleChoiceOptionsEl.children;
assert.strictEqual(wrongChoiceContext.dom.multipleChoiceFeedbackEl.textContent, "", "wrong answer should not show text feedback");
assert.strictEqual(wrongButtons[0].classList.contains("is-correct"), true, "correct option should get correct class after wrong answer");
assert.strictEqual(wrongButtons[1].classList.contains("is-wrong"), true, "selected wrong option should get wrong class");

const revealedChoiceContext = makeMultipleChoiceContext({
  multipleChoiceMode: true,
  multipleChoiceAnswer: { selectedText: "expand", correctText: "abandon", isCorrect: false },
  multipleChoiceRevealedOptionIndexes: [1]
});
renderMultipleChoice(revealedChoiceContext);
assert.strictEqual(revealedChoiceContext.dom.multipleChoiceOptionsEl.children[1].textContent, "拡大する", "revealed wrong option should show secondary text");

const unrevealedChoiceContext = makeMultipleChoiceContext({
  multipleChoiceMode: true,
  multipleChoiceAnswer: { selectedText: "expand", correctText: "abandon", isCorrect: false },
  multipleChoiceRevealedOptionIndexes: []
});
renderMultipleChoice(unrevealedChoiceContext);
assert.strictEqual(unrevealedChoiceContext.dom.multipleChoiceOptionsEl.children[1].textContent, "expand", "unrevealed wrong option should show original text");

console.log("All UI tests passed.");


