const LEGACY_ROW_ID_PATTERN = /^vol\d+-\d+-(.+)$/;
const LEGACY_SCOPED_WORD_PATTERN = /^(vol\d+)::(.+)$/;
const STABLE_WORD_ID_PATTERN = /^w_[a-z0-9]+$/;

export function normalizeWordKey(word) {
  return String(word ?? "").toLowerCase().trim();
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

function getWordScopeKey(volName, wordKey) {
  return `${normalizeWordKey(volName)}::${wordKey}`;
}

function getRecordKeyParts(key) {
  const normalizedKey = normalizeWordKey(key);
  const rowIdMatch = normalizedKey.match(LEGACY_ROW_ID_PATTERN);
  if (rowIdMatch) {
    return {
      volName: normalizedKey.split("-", 1)[0],
      wordKey: rowIdMatch[1]
    };
  }

  const scopedWordMatch = normalizedKey.match(LEGACY_SCOPED_WORD_PATTERN);
  if (scopedWordMatch) {
    return {
      volName: scopedWordMatch[1],
      wordKey: scopedWordMatch[2]
    };
  }

  return {
    volName: "",
    wordKey: normalizedKey
  };
}

function isStableWordId(key) {
  return STABLE_WORD_ID_PATTERN.test(normalizeWordKey(key));
}

function buildLegacyWordKeyMap(allWordsByVol) {
  const stableIdKeys = new Set();
  const wordKeyMap = new Map();
  const scopedWordKeyMap = new Map();

  Object.entries(allWordsByVol || {}).forEach(([volName, wordList]) => {
    (wordList || []).forEach((item) => {
      const newKey = makeWordKey(item);
      if (!newKey) return;
      stableIdKeys.add(newKey);

      getLegacyWordKeys(item).forEach((legacyKey) => {
        if (legacyKey === newKey) return;
        if (!wordKeyMap.has(legacyKey)) wordKeyMap.set(legacyKey, newKey);
        const scopedKey = getWordScopeKey(item?.sourceVol || volName, legacyKey);
        if (!scopedWordKeyMap.has(scopedKey)) scopedWordKeyMap.set(scopedKey, newKey);
      });
    });
  });

  return { stableIdKeys, wordKeyMap, scopedWordKeyMap };
}

export function getWordRecordKey(records, item) {
  const stableKey = makeWordKey(item);
  if (!records || typeof records !== "object" || Array.isArray(records)) return stableKey;
  if (records[stableKey]) return stableKey;

  const legacyKeys = getLegacyWordKeys(item);
  for (const legacyKey of legacyKeys) {
    if (records[legacyKey]) return legacyKey;
  }

  const sourceVol = normalizeWordKey(item?.sourceVol);
  for (const recordKey of Object.keys(records)) {
    const { volName, wordKey } = getRecordKeyParts(recordKey);
    if (sourceVol && volName && sourceVol !== volName) continue;
    if (legacyKeys.includes(wordKey)) return recordKey;
  }

  return stableKey;
}

export function migrateLegacyWordRecords(records, allWordsByVol) {
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    return { changed: false };
  }

  let changed = false;
  const { stableIdKeys, wordKeyMap, scopedWordKeyMap } = buildLegacyWordKeyMap(allWordsByVol);

  Object.keys(records).forEach((recordKey) => {
    const normalizedRecordKey = normalizeWordKey(recordKey);
    const { volName, wordKey } = getRecordKeyParts(recordKey);
    const scopedTargetKey = volName ? scopedWordKeyMap.get(getWordScopeKey(volName, wordKey)) : "";
    const newKey = scopedTargetKey || wordKeyMap.get(wordKey);

    if (stableIdKeys.has(normalizedRecordKey) || isStableWordId(recordKey)) return;

    if (newKey && !records[newKey]) {
      records[newKey] = records[recordKey];
    }
    delete records[recordKey];
    changed = true;
  });

  return { changed };
}

export function normalizeStoredWordKey(key) {
  const normalizedKey = normalizeWordKey(key);
  const legacyMatch = normalizedKey.match(LEGACY_ROW_ID_PATTERN);
  if (legacyMatch) return legacyMatch[1];

  const scopedWordMatch = normalizedKey.match(LEGACY_SCOPED_WORD_PATTERN);
  return scopedWordMatch ? scopedWordMatch[2] : normalizedKey;
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
