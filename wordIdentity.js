const LEGACY_ROW_ID_PATTERN = /^vol\d+-\d+-(.+)$/;

export function normalizeWordKey(word) {
  return String(word ?? "").trim().toLowerCase();
}

export function makeWordKey(item) {
  return normalizeWordKey(item?.id || item?.word);
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
