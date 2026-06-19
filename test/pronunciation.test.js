import assert from "assert";
import {
  initPronunciation,
  loadPronunciation
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

console.log("All pronunciation tests passed.");
