import { clampIndex } from "./wordList.js";

export function getPreserveWordId(words, index) {
  return words[index]?.id || null;
}

export function getReloadedIndex({ words, previousIndex, preserveWordId }) {
  if (preserveWordId) {
    const preservedIndex = words.findIndex((item) => item?.id === preserveWordId);
    if (preservedIndex >= 0) return preservedIndex;
  }

  return clampIndex(previousIndex, words);
}
