import assert from "assert";
import {
  clearNavigationHistory,
  getHistoryBackStack,
  getHistoryForwardStack,
  getRandomNextIndexFromHistory,
  getRandomPrevIndexFromHistory,
  initNavigation,
  moveToIndex
} from "../navigation.js";

let index = 0;
let renderCount = 0;
let speechSyncCount = 0;
let wordsLength = 4;

function resetNavigationState() {
  index = 0;
  renderCount = 0;
  speechSyncCount = 0;
  wordsLength = 4;
  clearNavigationHistory();
  initNavigation({
    getIndex: () => index,
    setIndex: (nextIndex) => { index = nextIndex; },
    renderCurrentWord: () => { renderCount += 1; },
    scheduleSpeechSync: () => { speechSyncCount += 1; },
    getWordsLength: () => wordsLength
  });
}

resetNavigationState();
moveToIndex(2, { pushHistory: true });
assert.strictEqual(index, 2, "moveToIndex should update the current index");
assert.strictEqual(renderCount, 1, "moveToIndex should render after movement");
assert.strictEqual(speechSyncCount, 1, "moveToIndex should schedule speech sync after movement");
assert.deepStrictEqual(getHistoryBackStack(), [0], "moveToIndex should push the previous index when requested");

const prev = getRandomPrevIndexFromHistory();
assert.strictEqual(prev, 0, "history back should return the previous index");
assert.deepStrictEqual(getHistoryForwardStack(), [2], "history back should push the current index to forward history");

index = prev;
const next = getRandomNextIndexFromHistory();
assert.strictEqual(next, 2, "history forward should return the forward index");
assert.deepStrictEqual(getHistoryBackStack(), [0], "history forward should push the current index to back history");

resetNavigationState();
moveToIndex(-1, { pushHistory: true });
moveToIndex(4, { pushHistory: true });
moveToIndex(0, { pushHistory: true });
assert.strictEqual(index, 0, "invalid or same-index moves should not change index");
assert.strictEqual(renderCount, 0, "invalid or same-index moves should not render");
assert.deepStrictEqual(getHistoryBackStack(), [], "invalid or same-index moves should not update history");

resetNavigationState();
moveToIndex(1, { pushHistory: true });
moveToIndex(2, { pushHistory: true });
wordsLength = 1;
assert.strictEqual(getRandomPrevIndexFromHistory(), 0, "history should skip entries outside the current word length");

console.log("All navigation tests passed.");
