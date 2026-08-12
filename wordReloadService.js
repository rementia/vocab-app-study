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

function getTotalWordCount(volumes, wordsByVol) {
  return volumes.reduce((total, volName) => total + (wordsByVol[volName] || []).length, 0);
}

function hasClassificationInfo(item) {
  return Boolean(
    String(item?.partOfSpeech ?? "").trim() ||
    String(item?.semanticCategory ?? "").trim()
  );
}

function getClassificationCount(volumes, wordsByVol) {
  return volumes.reduce(
    (total, volName) => total + (wordsByVol[volName] || []).filter(hasClassificationInfo).length,
    0
  );
}

function getSyncMessagePart(volumes, metaByVol) {
  const syncLabels = volumes
    .map((volName) => metaByVol?.[volName]?.syncLabel)
    .filter(Boolean);

  if (!syncLabels.length) return "";

  const uniqueLabels = [...new Set(syncLabels)];
  if (uniqueLabels.length === 1) {
    return ` / 同期: ${uniqueLabels[0]}`;
  }

  return " / 同期情報あり";
}

function getClassificationMessagePart(volumes, wordsByVol) {
  const total = getTotalWordCount(volumes, wordsByVol);
  if (!total) return "";

  const classified = getClassificationCount(volumes, wordsByVol);
  return classified > 0
    ? ` / 分類: ${classified}/${total}語`
    : " / 分類情報なし";
}

export function formatReloadSuccessMessage({ volumes, wordsByVol, metaByVol = {} }) {
  if (volumes.length === 1) {
    const volName = volumes[0];
    const count = (wordsByVol[volName] || []).length;
    return `${volName} を再読み込みしました（${count}語${getSyncMessagePart(volumes, metaByVol)}${getClassificationMessagePart(volumes, wordsByVol)}）`;
  }

  return `全volumeを再読み込みしました（合計${getTotalWordCount(volumes, wordsByVol)}語${getSyncMessagePart(volumes, metaByVol)}${getClassificationMessagePart(volumes, wordsByVol)}）`;
}
