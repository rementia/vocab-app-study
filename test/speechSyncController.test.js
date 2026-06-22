import assert from "assert";
import { createSpeechSyncController } from "../speechSyncController.js";

let savedValue = null;
let updated = 0;
let speakCalls = 0;
let unlockCalls = 0;
let pointerHandler = null;
const timers = [];

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalDocument = globalThis.document;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

Object.defineProperty(globalThis, "navigator", {
  value: { userActivation: { hasBeenActive: false, isActive: false } },
  configurable: true
});
globalThis.document = {
  addEventListener(type, handler) {
    if (type === "pointerdown") pointerHandler = handler;
  },
  removeEventListener(type, handler) {
    if (type === "pointerdown" && pointerHandler === handler) pointerHandler = null;
  }
};
globalThis.setTimeout = (handler, delay) => {
  const timer = { handler, delay, cleared: false };
  timers.push(timer);
  return timer;
};
globalThis.clearTimeout = (timer) => {
  if (timer) timer.cleared = true;
};

const controller = createSpeechSyncController({
  delayMs: 260,
  saveSpeechSyncState: (value) => { savedValue = value; },
  updateSpeechSyncButton: () => { updated += 1; },
  speakWord: () => { speakCalls += 1; },
  shouldBlockSpeech: () => false,
  unlockPronunciationAudio: () => { unlockCalls += 1; },
  requestFrame: (callback) => callback()
});

controller.toggle();
assert.strictEqual(controller.isEnabled(), true);
assert.strictEqual(savedValue, true);
assert.strictEqual(updated, 1);
assert.strictEqual(typeof pointerHandler, "function", "speech sync should wait for user activation when the browser requires it");

pointerHandler();
assert.strictEqual(unlockCalls, 1, "activation should unlock audio before the first swipe completes");
assert.strictEqual(speakCalls, 0, "activation should not pronounce the old word during swipe start");
assert.strictEqual(pointerHandler, null, "activation listener should be removed after unlock");

globalThis.navigator.userActivation.hasBeenActive = true;
controller.schedule();
assert.strictEqual(timers.at(-1).delay, 260);
timers.at(-1).handler();
assert.strictEqual(speakCalls, 1, "scheduled speech sync should speak after delay");

controller.toggle();
assert.strictEqual(controller.isEnabled(), false);
assert.strictEqual(savedValue, false);

if (originalNavigatorDescriptor) {
  Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
} else {
  delete globalThis.navigator;
}
globalThis.document = originalDocument;
globalThis.setTimeout = originalSetTimeout;
globalThis.clearTimeout = originalClearTimeout;

console.log("All speech sync controller tests passed.");
