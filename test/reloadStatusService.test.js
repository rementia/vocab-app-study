import assert from "assert";
import { createReloadStatusController } from "../reloadStatusService.js";

let status = "";
const timers = [];
const clearedTimers = [];

const controller = createReloadStatusController({
  setStatus: (message) => {
    status = message;
  },
  setTimeoutFn: (callback, delay) => {
    const timer = { callback, delay };
    timers.push(timer);
    return timer;
  },
  clearTimeoutFn: (timer) => {
    clearedTimers.push(timer);
  }
});

controller.set("単語データを更新しました", { clearAfterMs: 4000 });
assert.strictEqual(status, "単語データを更新しました");
assert.strictEqual(timers.length, 1);
assert.strictEqual(timers[0].delay, 4000);

controller.set("単語データを再読み込みしています...");
assert.strictEqual(status, "単語データを再読み込みしています...");
assert.strictEqual(clearedTimers[0], timers[0], "setting a new status should clear the previous timer");

controller.set("単語データを更新しました", { clearAfterMs: 4000 });
timers[1].callback();
assert.strictEqual(status, "", "success status should clear after its timer fires");

controller.set("単語データの再読み込みに失敗しました");
assert.strictEqual(status, "単語データの再読み込みに失敗しました");
assert.strictEqual(timers.length, 2, "failure status should not schedule an automatic clear by default");

console.log("All reload status service tests passed.");
