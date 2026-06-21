import assert from "assert";
import {
  buildSheetSyncRequestBody,
  createSheetSyncNotConfiguredResult,
  hasSheetSyncConfig,
  syncSheetToFirestore
} from "../sheetSyncService.js";

assert.strictEqual(hasSheetSyncConfig({ url: "" }), false);
assert.strictEqual(hasSheetSyncConfig({ url: "  " }), false);
assert.strictEqual(hasSheetSyncConfig({ url: "https://script.google.com/macros/s/example/exec" }), true);

assert.strictEqual(
  buildSheetSyncRequestBody({ token: "sample-token" }),
  JSON.stringify({ token: "sample-token" })
);

assert.deepStrictEqual(
  createSheetSyncNotConfiguredResult(),
  {
    ok: true,
    skipped: true,
    message: "Sheets同期URLが未設定のため、Firestoreのみ再読み込みしました"
  }
);

const skippedResult = await syncSheetToFirestore({ url: "", token: "token" });
assert.strictEqual(skippedResult.skipped, true);

let fetchCalled = false;
const successResult = await syncSheetToFirestore({
  url: "https://script.google.com/macros/s/example/exec",
  token: "token",
  fetchFn: async (url, options) => {
    fetchCalled = true;
    assert.strictEqual(url, "https://script.google.com/macros/s/example/exec");
    assert.strictEqual(options.method, "POST");
    assert.strictEqual(options.body, JSON.stringify({ token: "token" }));

    return {
      ok: true,
      json: async () => ({
        ok: true,
        syncedAt: "2026-06-20T12:34:56.000Z",
        volumes: [{ docId: "vol1", rowCount: 1200 }]
      })
    };
  }
});

assert.strictEqual(fetchCalled, true);
assert.deepStrictEqual(successResult, {
  ok: true,
  skipped: false,
  syncedAt: "2026-06-20T12:34:56.000Z",
  volumes: [{ docId: "vol1", rowCount: 1200 }]
});

const failureResult = await syncSheetToFirestore({
  url: "https://script.google.com/macros/s/example/exec",
  token: "bad-token",
  fetchFn: async () => ({
    ok: true,
    json: async () => ({
      ok: false,
      error: "Invalid token"
    })
  })
});

assert.deepStrictEqual(failureResult, {
  ok: false,
  error: "Invalid token"
});

console.log("All sheet sync service tests passed.");
