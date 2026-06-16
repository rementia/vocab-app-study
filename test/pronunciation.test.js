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
globalThis.fetch = async () => ({
  ok: false,
  json: async () => {
    throw new Error("HTTP errors should not be parsed as pronunciation data");
  }
});

initPronunciation({
  el: pronunciationEl,
  getCurrentWord: () => ({ word: "missing" })
});

await loadPronunciation("Missing");
assert.strictEqual(pronunciationEl.textContent, "発音記号なし", "HTTP errors should render as no pronunciation");
assert.strictEqual(values.has("vocab_app_study_pron_missing"), false, "HTTP errors should not be cached");

console.log("All pronunciation tests passed.");
