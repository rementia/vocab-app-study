import assert from "assert";
import { bindKeyboardEvents, bindTouchEvents } from "../events.js";

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

function dispatchKey({
  key,
  code = "",
  target = {},
  shiftKey = false,
  ctrlKey = false,
  metaKey = false,
  altKey = false,
  isComposing = false
}) {
  let prevented = false;
  keydownHandler({
    key,
    code,
    target,
    shiftKey,
    ctrlKey,
    metaKey,
    altKey,
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

calls = makeCalls();
bindWithCalls(calls);
assert.strictEqual(dispatchKey({ key: "-", ctrlKey: true }), false);
assert.strictEqual(calls.decreaseReview, 0, "Ctrl+- should keep browser zoom behavior");
assert.strictEqual(dispatchKey({ key: "+", ctrlKey: true }), false);
assert.strictEqual(calls.increaseReview, 0, "Ctrl++ should keep browser zoom behavior");
assert.strictEqual(dispatchKey({ key: "0", ctrlKey: true }), false);
assert.strictEqual(calls.resetReview, 0, "Ctrl+0 should keep browser zoom reset behavior");
assert.strictEqual(dispatchKey({ key: "f", ctrlKey: true }), false);
assert.strictEqual(calls.favorite, 0, "Ctrl+F should keep browser find behavior");

class MockElement {
  closest() {
    return null;
  }
}

globalThis.Element = MockElement;

let touchStartHandler = null;
let touchEndHandler = null;
globalThis.document = {
  addEventListener(type, handler) {
    if (type === "touchstart") touchStartHandler = handler;
    if (type === "touchend") touchEndHandler = handler;
  }
};

const swipeCalls = [];
let swipeMoveResult = true;
bindTouchEvents({
  prevWord: (options) => {
    swipeCalls.push({ direction: "prev", options });
    return swipeMoveResult;
  },
  nextWord: (options) => {
    swipeCalls.push({ direction: "next", options });
    return swipeMoveResult;
  },
  isSwipeAllowedTarget: () => true
});

let now = 1000;
const originalDateNow = Date.now;
Date.now = () => now;

function dispatchTouch(handler, x, y) {
  let prevented = false;
  handler({
    changedTouches: [{ screenX: x, screenY: y }],
    target: new MockElement(),
    preventDefault() {
      prevented = true;
    }
  });
  return prevented;
}

dispatchTouch(touchStartHandler, 100, 100);
now += 100;
dispatchTouch(touchEndHandler, 120, 105);
assert.strictEqual(swipeCalls.length, 0, "short swipes should not move words");

dispatchTouch(touchStartHandler, 100, 100);
now += 100;
dispatchTouch(touchEndHandler, 30, 100);
assert.deepStrictEqual(
  swipeCalls.at(-1),
  { direction: "next", options: { immediateSpeechSync: true, reason: "swipe" } },
  "first completed swipe should request immediate speech sync"
);

dispatchTouch(touchStartHandler, 100, 100);
now += 100;
dispatchTouch(touchEndHandler, 30, 100);
assert.deepStrictEqual(
  swipeCalls.at(-1),
  { direction: "next", options: { immediateSpeechSync: false, reason: "swipe" } },
  "second completed swipe should keep the normal delayed speech sync"
);

swipeMoveResult = false;
const blockedSwipeCalls = [];
bindTouchEvents({
  prevWord: (options) => {
    blockedSwipeCalls.push({ direction: "prev", options });
    return false;
  },
  nextWord: (options) => {
    blockedSwipeCalls.push({ direction: "next", options });
    return false;
  },
  isSwipeAllowedTarget: () => true
});

dispatchTouch(touchStartHandler, 100, 100);
now += 100;
dispatchTouch(touchEndHandler, 30, 100);
dispatchTouch(touchStartHandler, 100, 100);
now += 100;
dispatchTouch(touchEndHandler, 30, 100);
assert.deepStrictEqual(
  blockedSwipeCalls.map((call) => call.options.immediateSpeechSync),
  [true, true],
  "failed swipe movement should not consume the first immediate speech sync attempt"
);

Date.now = originalDateNow;

console.log("All keyboard shortcut tests passed.");
