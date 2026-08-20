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
let verifiedFetchCalls = 0;
globalThis.fetch = async () => {
  verifiedFetchCalls += 1;
  throw new Error("verified pronunciation must not hit the external fallback");
};
initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({
    word: "abandon",
    phonetic: "/əˈbændən/",
    pronunciationStatus: "verified",
    pronunciationSource: "CMUdict"
  })
});
await loadPronunciation("Abandon");
assert.strictEqual(pronunciationEl.textContent, "əˈbændən", "verified IPA should be preferred over caches and API fallback");
assert.strictEqual(verifiedFetchCalls, 0, "verified IPA should not call the external fallback API");

values = installMockStorage();
let reviewFetchCalls = 0;
globalThis.fetch = async () => {
  reviewFetchCalls += 1;
  return { json: async () => [{ phonetic: "/unsafe/" }] };
};
initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "cupful", pronunciationStatus: "needs_review" })
});
await loadPronunciation("Cupful");
assert.strictEqual(pronunciationEl.textContent, "発音記号要確認", "audited unresolved words should remain explicitly unresolved");
assert.strictEqual(reviewFetchCalls, 0, "audited unresolved words must not accept API fallback as final pronunciation data");

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
const originalAudio = globalThis.Audio;
const originalConsoleWarn = console.warn;

let speakCalls = 0;
let resumeCalls = 0;
let boundEvents = [];
let eventHandlers = {};
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
  getCurrentWord: () => ({ word: "blocked" })
});
const blockedResult = safePlayPronunciation();
assert.deepStrictEqual(blockedResult, { ok: false, blocked: true }, "speech should be marked as blocked before user activation");
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
initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "allowed" })
});
const allowedResult = safePlayPronunciation();
assert.deepStrictEqual(
  allowedResult,
  { ok: true, source: "browser-tts", voice: "", localService: null },
  "speech should report the current browser-TTS result contract after user activation"
);
assert.strictEqual(speakCalls, 1, "allowed speech should call speechSynthesis.speak once");

let verifiedAudioPlayCalls = 0;
let verifiedAudioUrl = "";
globalThis.Audio = class {
  constructor(url) {
    verifiedAudioUrl = url;
    this.currentTime = 0;
  }
  play() {
    verifiedAudioPlayCalls += 1;
    return Promise.resolve();
  }
  pause() {}
};
initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({
    word: "verified-audio",
    pronunciationAudioUrl: "https://example.invalid/verified.mp3",
    pronunciationStatus: "verified"
  })
});
const verifiedAudioResult = safePlayPronunciation();
assert.deepStrictEqual(
  verifiedAudioResult,
  { ok: true, source: "verified-audio" },
  "verified audio URL should report the verified-audio result contract"
);
assert.strictEqual(verifiedAudioPlayCalls, 1, "verified audio should be preferred over browser TTS when a URL is present");
assert.strictEqual(verifiedAudioUrl, "https://example.invalid/verified.mp3");
assert.strictEqual(speakCalls, 1, "verified audio should not invoke browser TTS when playback starts successfully");

if (originalWindow === undefined) delete globalThis.window;
else globalThis.window = originalWindow;
if (originalNavigatorDescriptor) {
  Object.defineProperty(globalThis, "navigator", originalNavigatorDescriptor);
} else {
  delete globalThis.navigator;
}
globalThis.document = originalDocument;
globalThis.SpeechSynthesisUtterance = originalSpeechSynthesisUtterance;
if (originalAudio === undefined) delete globalThis.Audio;
else globalThis.Audio = originalAudio;
console.warn = originalConsoleWarn;

console.log("All pronunciation tests passed.");
