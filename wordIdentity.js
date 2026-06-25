const LEGACY_ROW_ID_PATTERN = /^vol\d+-\d+-(.+)$/;

export function normalizeWordKey(word) {
  return String(word ?? "").trim().toLowerCase();
}

export function makeWordKey(item) {
  return normalizeWordKey(item?.id || item?.word);
}

function getLegacyWordKeys(item) {
  return [
    item?.legacyWordKey,
    normalizeWordKey(item?.word)
  ].filter((key, index, keys) => key && keys.indexOf(key) === index);
}

export function migrateLegacyWordRecords(records, allWordsByVol) {
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    return { changed: false };
  }

  let changed = false;
  Object.values(allWordsByVol || {}).forEach((wordList) => {
    (wordList || []).forEach((item) => {
      const newKey = makeWordKey(item);
      if (!newKey) return;

      getLegacyWordKeys(item).forEach((legacyKey) => {
        if (legacyKey === newKey || !records[legacyKey]) return;

        if (!records[newKey]) {
          records[newKey] = records[legacyKey];
        }
        delete records[legacyKey];
        changed = true;
      });
    });
  });

  return { changed };
}
export function normalizeStoredWordKey(key) {
  const normalizedKey = normalizeWordKey(key);
  const legacyMatch = normalizedKey.match(LEGACY_ROW_ID_PATTERN);
  return legacyMatch ? legacyMatch[1] : normalizedKey;
}

export function normalizeWordRecordMap(records) {
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    return {};
  }

  return Object.entries(records).reduce((normalized, [key, value]) => {
    const normalizedKey = normalizeStoredWordKey(key);
    if (!normalizedKey) return normalized;

    normalized[normalizedKey] = {
      ...(normalized[normalizedKey] || {}),
      ...(value && typeof value === "object" ? value : {})
    };

    return normalized;
  }, {});
}
