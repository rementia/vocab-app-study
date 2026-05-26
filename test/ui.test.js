import assert from "assert";
import { renderCurrentWord, updateAuthUI, updateAutoPlayButton, updateCurrentLabel, updateRecallTimeControl, updateReviewButtons } from "../ui.js";

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
    currentVol: "vol4",
    frequencyMode: true,
    randomMode: true
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
    textContent: "",
    attributes: {},
    classList: {
      values: new Set(),
      toggle(name, force) {
        if (force) this.values.add(name);
        else this.values.delete(name);
      },
      contains(name) {
        return this.values.has(name);
      }
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    }
  };
}

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
assert.strictEqual(autoPlayButton.textContent, "循環再生");
assert.strictEqual(autoPlayButton.attributes["aria-pressed"], "true");
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

console.log("All UI tests passed.");
