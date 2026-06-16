import assert from "assert";
import {
  LEGACY_STORAGE_KEYS,
  STORAGE_KEYS,
  safeGetItem,
  safeSetItem,
  saveCurrentModeState,
  saveCurrentVol,
  saveSpeechSyncState,
  saveChallengeTimeState,
  saveDisplayTimeState,
  saveFavoritesToLocalOnly,
  saveDifficultsToLocalOnly,
  saveDifficultsUpdatedAt,
  saveFrequencyModeState,
  saveIndexByVol
} from "../storage.js";

function installMockStorage({ throwOnGet = false, throwOnSet = false } = {}) {
  const values = new Map();
  globalThis.localStorage = {
    getItem(key) {
      if (throwOnGet) throw new Error("get failed");
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error("set failed");
      values.set(key, String(value));
    }
  };
  return values;
}

const originalWarn = console.warn;
const warnings = [];
console.warn = (...args) => warnings.push(args);

const values = installMockStorage();
safeSetItem("plain", "value");
assert.strictEqual(safeGetItem("plain"), "value", "safe helpers should write and read string values");

saveCurrentVol("vol3");
assert.strictEqual(values.get(STORAGE_KEYS.vol), "vol3", "saveCurrentVol should store the current volume as a string");

saveCurrentModeState("favorites");
assert.strictEqual(values.get(STORAGE_KEYS.mode), "favorites", "saveCurrentModeState should store the current mode as a string");

saveIndexByVol({ vol1: 2, favorites: 1 });
assert.strictEqual(values.get(STORAGE_KEYS.indexByVol), "{\"vol1\":2,\"favorites\":1}", "saveIndexByVol should serialize index state");

saveFavoritesToLocalOnly({ hello: { addedAt: 123 } });
assert.strictEqual(values.get(STORAGE_KEYS.favorites), "{\"hello\":{\"addedAt\":123}}", "saveFavoritesToLocalOnly should serialize favorites");

saveDifficultsToLocalOnly({ hard: { addedAt: 234 } });
assert.strictEqual(values.get(STORAGE_KEYS.difficults), "{\"hard\":{\"addedAt\":234}}", "saveDifficultsToLocalOnly should serialize difficult words");

saveDifficultsUpdatedAt(456);
assert.strictEqual(values.get(STORAGE_KEYS.difficultsUpdatedAt), "456", "saveDifficultsUpdatedAt should store timestamps as strings");

saveSpeechSyncState(true);
assert.strictEqual(values.get(STORAGE_KEYS.speechSync), "true", "saveSpeechSyncState should store booleans as strings");

saveChallengeTimeState(1500);
assert.strictEqual(values.get(STORAGE_KEYS.challengeTime), "1500", "saveChallengeTimeState should store numbers as strings");

saveDisplayTimeState(1800);
assert.strictEqual(values.get(STORAGE_KEYS.displayTime), "1800", "saveDisplayTimeState should store numbers as strings");

const legacyValues = installMockStorage();
legacyValues.set(LEGACY_STORAGE_KEYS.vol, "vol2");
assert.strictEqual(safeGetItem(STORAGE_KEYS.vol), "vol2", "safeGetItem should fall back to legacy keys");

installMockStorage({ throwOnGet: true });
assert.doesNotThrow(() => safeGetItem("blocked"), "safeGetItem should swallow storage read errors");
assert.strictEqual(safeGetItem("blocked"), null, "safeGetItem should return null after storage read errors");

installMockStorage({ throwOnSet: true });
assert.doesNotThrow(() => safeSetItem("blocked", "value"), "safeSetItem should swallow storage write errors");
assert.strictEqual(warnings.length, 3, "storage failures should be logged as warnings");

console.warn = originalWarn;
console.log("All storage tests passed.");
