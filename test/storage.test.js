import assert from "assert";
import {
  safeGetItem,
  safeSetItem,
  saveSpeechSyncState,
  saveChallengeTimeState,
  saveDisplayTimeState,
  saveFavoritesToLocalOnly,
  saveDifficultsToLocalOnly,
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

saveIndexByVol({ vol1: 2, favorites: 1 });
assert.strictEqual(values.get("tango_index_by_vol"), "{\"vol1\":2,\"favorites\":1}", "saveIndexByVol should serialize index state");

saveFavoritesToLocalOnly({ "vol1-2-hello": { addedAt: 123 } });
assert.strictEqual(values.get("tango_favorites"), "{\"vol1-2-hello\":{\"addedAt\":123}}", "saveFavoritesToLocalOnly should serialize favorites");

saveSpeechSyncState(true);
assert.strictEqual(values.get("tango_auto_speak"), "true", "saveSpeechSyncState should store booleans as strings");

saveChallengeTimeState(1500);
assert.strictEqual(values.get("tango_challenge_time"), "1500", "saveChallengeTimeState should store numbers as strings");

saveDisplayTimeState(1800);
assert.strictEqual(values.get("tango_display_time"), "1800", "saveDisplayTimeState should store numbers as strings");

installMockStorage({ throwOnGet: true });
assert.doesNotThrow(() => safeGetItem("blocked"), "safeGetItem should swallow storage read errors");
assert.strictEqual(safeGetItem("blocked"), null, "safeGetItem should return null after storage read errors");

installMockStorage({ throwOnSet: true });
assert.doesNotThrow(() => safeSetItem("blocked", "value"), "safeSetItem should swallow storage write errors");
assert.strictEqual(warnings.length, 3, "storage failures should be logged as warnings");

console.warn = originalWarn;
console.log("All storage tests passed.");
