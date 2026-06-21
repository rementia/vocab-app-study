import assert from "assert";
import {
  getPronunciationAudioUnlockState,
  initPronunciation,
  loadPronunciation,
  safePlayPronunciation,
  unlockPronunciationAudioOnce
} from "../pronunciation.js";

function installMockStorage() {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
  return values;
}

const pronunciationEl = { textContent: "" };
initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "create" })
});

let values = installMockStorage();
values.set("portfolio_pron_create", "kriˈeɪt");
await loadPronunciation("Create");
assert.strictEqual(pronunciationEl.textContent, "kriˈeɪt", "legacy pronunciation cache should still be readable");

values = installMockStorage();
globalThis.fetch = async () => ({
  json: async () => [{ phonetic: "/test/" }]
});

initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "test" })
});

await loadPronunciation("Test");
assert.strictEqual(pronunciationEl.textContent, "test", "loaded pronunciation should be rendered");
assert.strictEqual(values.get("vocab_app_study_pron_test"), "test", "new pronunciation cache should use the study app prefix");
assert.strictEqual(values.has("portfolio_pron_test"), false, "new pronunciation cache should not write the legacy prefix");

values = installMockStorage();
let missingFetchCalls = 0;
globalThis.fetch = async () => {
  missingFetchCalls += 1;
  return {
    ok: false,
    json: async () => {
      throw new Error("HTTP errors should not be parsed as pronunciation data");
    }
  };
};

initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "missing" })
});

await loadPronunciation("Missing");
await loadPronunciation("Missing");
assert.strictEqual(pronunciationEl.textContent, "発音記号なし", "HTTP errors should render as no pronunciation");
assert.strictEqual(values.has("vocab_app_study_pron_missing"), false, "HTTP errors should not be cached");
assert.strictEqual(missingFetchCalls, 1, "HTTP misses should be cached in memory without repeated fetches");

values = installMockStorage();
let emptyFetchCalls = 0;
globalThis.fetch = async () => {
  emptyFetchCalls += 1;
  return {
    json: async () => [{ phonetics: [] }]
  };
};

initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "empty" })
});

await loadPronunciation("Empty");
await loadPronunciation("Empty");
assert.strictEqual(pronunciationEl.textContent, "発音記号なし", "empty pronunciation results should render as no pronunciation");
assert.strictEqual(values.has("vocab_app_study_pron_empty"), false, "empty pronunciation results should not be stored in localStorage");
assert.strictEqual(emptyFetchCalls, 1, "empty pronunciation results should be cached in memory for this session");

const originalWindow = globalThis.window;
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalDocument = globalThis.document;
const originalSpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance;
const originalConsoleWarn = console.warn;

let speakCalls = 0;
let resumeCalls = 0;
let boundEvents = [];
let eventHandlers = {};
const audioUnlockPrompt = { hidden: true };
const audioUnlockButton = {
  addEventListener() {}
};

globalThis.window = {
  speechSynthesis: {
    cancel() {},
    resume() {
      resumeCalls += 1;
    },
    speak() {
      speakCalls += 1;
    }
  },
  SpeechSynthesisUtterance: class {
    constructor(text) {
      this.text = text;
    }
  }
};
globalThis.SpeechSynthesisUtterance = globalThis.window.SpeechSynthesisUtterance;
globalThis.document = {
  addEventListener(type, handler) {
    boundEvents.push(type);
    eventHandlers[type] = handler;
  },
  removeEventListener(type, handler) {
    boundEvents = boundEvents.filter((item) => item !== type);
    if (eventHandlers[type] === handler) delete eventHandlers[type];
  }
};
console.warn = () => {};

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { userActivation: { hasBeenActive: false, isActive: false } }
});
initPronunciation({
  el: pronunciationEl,
  audioUnlockPrompt,
  audioUnlockButton,
  getCurrentWord: () => ({ word: "blocked" })
});
const blockedResult = safePlayPronunciation();
assert.deepStrictEqual(blockedResult, { ok: false, blocked: true }, "speech should be marked as blocked before user activation");
assert.strictEqual(audioUnlockPrompt.hidden, false, "audio unlock prompt should be shown when speech is blocked");
assert.strictEqual(speakCalls, 0, "blocked speech should not call speechSynthesis.speak");
assert.ok(boundEvents.includes("touchstart"), "touchstart should be listened to for mobile audio unlock");
assert.ok(boundEvents.includes("click"), "click should be listened to for audio unlock");

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { userActivation: { hasBeenActive: false, isActive: true } }
});
eventHandlers.touchstart();
assert.strictEqual(resumeCalls, 1, "touchstart should try to unlock speech synthesis once");
assert.strictEqual(speakCalls, 0, "audio unlock should not pronounce the old word during swipe start");
assert.deepStrictEqual(
  getPronunciationAudioUnlockState(),
  { isAudioUnlocked: true, unlockAttempted: true, unlockInProgress: false },
  "audio unlock state should be stored after touchstart"
);
assert.deepStrictEqual(
  unlockPronunciationAudioOnce(),
  { ok: true, unlocked: true, attempted: false },
  "unlock should not retry once audio is already unlocked"
);
assert.strictEqual(resumeCalls, 1, "audio unlock should not run repeatedly after success");

Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { userActivation: { hasBeenActive: true, isActive: false } }
});
audioUnlockPrompt.hidden = false;
initPronunciation({
  el: pronunciationEl,
  audioUnlockPrompt,
  audioUnlockButton,
  getCurrentWord: () => ({ word: "allowed" })
});
const allowedResult = safePlayPronunciation();
assert.deepStrictEqual(allowedResult, { ok: true }, "speech should play after user activation");
assert.strictEqual(audioUnlockPrompt.hidden, true, "audio unlock prompt should be hidden after speech is allowed");
assert.strictEqual(speakCalls, 1, "allowed speech should call speechSynthesis.speak once");

globalThis.window = originalWindow;
if (originalNavigatorDescriptor) {
  Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
} else {
  delete globalThis.navigator;
}
globalThis.document = originalDocument;
globalThis.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
console.warn = originalConsoleWarn;

console.log("All pronunciation tests passed.");
