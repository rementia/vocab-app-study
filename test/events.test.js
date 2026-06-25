import assert from "assert";
import {
  bindKeyboardEvents,
  bindTouchEvents,
  getSwipeIntent,
  isSwipeAllowedTarget,
  resetSwipeElementState
} from "../events.js";

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
assert.strictEqual(dispatchKey({ key: "+", ctrlKey: true }), false);
assert.strictEqual(dispatchKey({ key: "0", ctrlKey: true }), false);
assert.strictEqual(dispatchKey({ key: "f", ctrlKey: true }), false);
assert.strictEqual(calls.favorite, 0, "Ctrl+F should keep browser find behavior");

assert.deepStrictEqual(
  getSwipeIntent(80, 10),
  { isHorizontal: true, shouldNavigate: true, direction: "right" },
  "large right swipe should navigate to the previous word"
);
assert.deepStrictEqual(
  getSwipeIntent(-80, 10),
  { isHorizontal: true, shouldNavigate: true, direction: "left" },
  "large left swipe should navigate to the next word"
);
assert.deepStrictEqual(
  getSwipeIntent(30, 5),
  { isHorizontal: true, shouldNavigate: false, direction: null },
  "short horizontal swipe should drag but not navigate"
);
assert.deepStrictEqual(
  getSwipeIntent(80, 80),
  { isHorizontal: false, shouldNavigate: false, direction: null },
  "vertical movement should not be treated as a card swipe"
);

class MockElement {
  constructor() {
    this.classes = new Set();
    this.style = { transform: "" };
    this.offsetWidth = 320;
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      toggle: (name, force) => {
        if (force) this.classes.add(name);
        else this.classes.delete(name);
      },
      contains: (name) => this.classes.has(name)
    };
  }

  closest() {
    return null;
  }

  getBoundingClientRect() {
    return { width: 320 };
  }
}

globalThis.Element = MockElement;

const buttonTarget = new MockElement();
buttonTarget.closest = (selector) => (selector.includes("button") ? {} : null);
assert.strictEqual(
  isSwipeAllowedTarget(buttonTarget),
  false,
  "multiple-choice option buttons should not start a swipe"
);
const sidebarTarget = new MockElement();
sidebarTarget.closest = (selector) => (selector === "#sidebar" ? {} : null);
assert.strictEqual(
  isSwipeAllowedTarget(sidebarTarget),
  false,
  "sidebar controls should not start a swipe"
);
assert.strictEqual(
  isSwipeAllowedTarget(new MockElement()),
  true,
  "plain card areas should be swipeable"
);

let touchStartHandler = null;
let touchMoveHandler = null;
let touchEndHandler = null;
globalThis.document = {
  addEventListener(type, handler) {
    if (type === "touchstart") touchStartHandler = handler;
    if (type === "touchmove") touchMoveHandler = handler;
    if (type === "touchend") touchEndHandler = handler;
  }
};

const swipeCalls = { prev: 0, next: 0 };
const swipeElement = new MockElement();
swipeElement.classList.add("is-dragging", "is-returning", "is-sliding");
swipeElement.style.transform = "translate3d(120px, 0, 0)";
resetSwipeElementState(swipeElement);
assert.strictEqual(swipeElement.classList.contains("is-dragging"), false, "swipe reset should clear dragging state");
assert.strictEqual(swipeElement.classList.contains("is-returning"), false, "swipe reset should clear returning state");
assert.strictEqual(swipeElement.classList.contains("is-sliding"), false, "swipe reset should clear sliding state");
assert.strictEqual(swipeElement.style.transform, "", "swipe reset should clear card transform");

bindTouchEvents({
  prevWord: () => { swipeCalls.prev += 1; },
  nextWord: () => { swipeCalls.next += 1; },
  isSwipeAllowedTarget: () => true,
  swipeElement
});

let now = 1000;
const originalDateNow = Date.now;
const originalSetTimeout = globalThis.setTimeout;
Date.now = () => now;
globalThis.setTimeout = (callback) => {
  callback();
  return 1;
};

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
now += 50;
const shortSwipePrevented = dispatchTouch(touchMoveHandler, 135, 104);
assert.strictEqual(shortSwipePrevented, true, "short horizontal swipes should be handled as card drag");
assert.strictEqual(swipeElement.style.transform, "translate3d(35px, 0, 0)");
dispatchTouch(touchEndHandler, 135, 104);
assert.strictEqual(swipeCalls.next, 0, "short swipes should not move to the next word");
assert.strictEqual(swipeElement.style.transform, "", "short swipes should return the card to center");

dispatchTouch(touchStartHandler, 100, 100);
now += 50;
const verticalPrevented = dispatchTouch(touchMoveHandler, 120, 160);
assert.strictEqual(verticalPrevented, false, "vertical scroll should not be prevented");
assert.strictEqual(swipeElement.style.transform, "", "vertical movement should not drag the card");
dispatchTouch(touchEndHandler, 120, 160);

dispatchTouch(touchStartHandler, 100, 100);
now += 50;
dispatchTouch(touchMoveHandler, 10, 100);
dispatchTouch(touchEndHandler, 10, 100);
assert.strictEqual(swipeCalls.next, 1, "left swipe should move to the next word");
assert.strictEqual(swipeElement.style.transform, "", "completed swipes should reset card transform");

dispatchTouch(touchStartHandler, 100, 100);
now += 50;
dispatchTouch(touchMoveHandler, 190, 100);
dispatchTouch(touchEndHandler, 190, 100);
assert.strictEqual(swipeCalls.prev, 1, "right swipe should move to the previous word");

Date.now = originalDateNow;
globalThis.setTimeout = originalSetTimeout;

console.log("All keyboard shortcut tests passed.");
