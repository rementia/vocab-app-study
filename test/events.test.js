import assert from "assert";
import { bindKeyboardEvents } from "../events.js";

class MockInput {
  constructor() {
    this.blurred = false;
  }

  blur() {
    this.blurred = true;
  }
}

class MockTextArea extends MockInput {}
class MockSelect extends MockInput {}

globalThis.HTMLInputElement = MockInput;
globalThis.HTMLTextAreaElement = MockTextArea;
globalThis.HTMLSelectElement = MockSelect;

let keydownHandler = null;
globalThis.document = {
  addEventListener(type, handler) {
    if (type === "keydown") keydownHandler = handler;
  }
};

function makeCalls() {
  return {
    prevWord: 0,
    nextWord: 0,
    speakWord: 0,
    favorite: 0,
    difficult: 0,
    decreaseReview: 0,
    resetReview: 0,
    increaseReview: 0,
    focusSearch: 0,
    clearSearch: 0,
    nextSearch: 0,
    previousSearch: 0,
    closeSidebar: 0,
    toggleSidebar: 0,
    random: 0
  };
}

function bindWithCalls(calls, clearSearchResult = false) {
  bindKeyboardEvents({
    prevWord: () => calls.prevWord++,
    nextWord: () => calls.nextWord++,
    speakWord: () => calls.speakWord++,
    handleToggleFavoriteCurrentWord: () => calls.favorite++,
    handleToggleDifficultCurrentWord: () => calls.difficult++,
    decreaseReviewScore: () => calls.decreaseReview++,
    resetReviewScore: () => calls.resetReview++,
    increaseReviewScore: () => calls.increaseReview++,
    focusSearch: () => calls.focusSearch++,
    clearSearch: () => {
      calls.clearSearch++;
      return clearSearchResult;
    },
    selectNextSearchResult: () => calls.nextSearch++,
    selectPreviousSearchResult: () => calls.previousSearch++,
    closeSidebar: () => calls.closeSidebar++,
    toggleSidebar: () => calls.toggleSidebar++,
    toggleRandomMode: () => calls.random++
  });
}

function dispatchKey({ key, code = "", target = {}, shiftKey = false, isComposing = false }) {
  let prevented = false;
  keydownHandler({
    key,
    code,
    target,
    shiftKey,
    isComposing,
    preventDefault() {
      prevented = true;
    }
  });
  return prevented;
}

let calls = makeCalls();
bindWithCalls(calls);

assert.strictEqual(dispatchKey({ key: "ArrowLeft" }), true);
assert.strictEqual(calls.prevWord, 1);

assert.strictEqual(dispatchKey({ key: "ArrowRight" }), true);
assert.strictEqual(calls.nextWord, 1);

assert.strictEqual(dispatchKey({ key: " ", code: "Space" }), true);
assert.strictEqual(calls.speakWord, 1);

assert.strictEqual(dispatchKey({ key: "f" }), true);
assert.strictEqual(calls.favorite, 1);

assert.strictEqual(dispatchKey({ key: "D" }), true);
assert.strictEqual(calls.difficult, 1);

assert.strictEqual(dispatchKey({ key: "+" }), true);
assert.strictEqual(calls.increaseReview, 1);

assert.strictEqual(dispatchKey({ key: "-" }), true);
assert.strictEqual(calls.decreaseReview, 1);

assert.strictEqual(dispatchKey({ key: "0" }), true);
assert.strictEqual(calls.resetReview, 1);

assert.strictEqual(dispatchKey({ key: "/" }), true);
assert.strictEqual(calls.focusSearch, 1);

assert.strictEqual(dispatchKey({ key: "L" }), true);
assert.strictEqual(calls.toggleSidebar, 1);

assert.strictEqual(dispatchKey({ key: "Escape" }), true);
assert.strictEqual(calls.closeSidebar, 1);

assert.strictEqual(dispatchKey({ key: "r" }), true);
assert.strictEqual(calls.random, 1);

const input = new MockInput();
assert.strictEqual(dispatchKey({ key: "Enter", target: input }), true);
assert.strictEqual(calls.nextSearch, 1);
assert.strictEqual(input.blurred, false);

assert.strictEqual(dispatchKey({ key: "Enter", target: input, shiftKey: true }), true);
assert.strictEqual(calls.previousSearch, 1);

assert.strictEqual(dispatchKey({ key: "f", target: input }), false);
assert.strictEqual(calls.favorite, 1, "typing in search should not trigger word shortcuts");

assert.strictEqual(dispatchKey({ key: "Escape", target: input }), true);
assert.strictEqual(calls.clearSearch, 1);
assert.strictEqual(input.blurred, true, "Escape should blur when there is no search text to clear");

calls = makeCalls();
bindWithCalls(calls, true);
const inputWithText = new MockInput();
assert.strictEqual(dispatchKey({ key: "Escape", target: inputWithText }), true);
assert.strictEqual(calls.clearSearch, 1);
assert.strictEqual(inputWithText.blurred, false, "Escape should keep focus when it clears search text");

assert.strictEqual(dispatchKey({ key: "ArrowRight", isComposing: true }), false);
assert.strictEqual(calls.nextWord, 0, "IME composing keys should be ignored");

console.log("All keyboard shortcut tests passed.");