import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";
import { normalizeWordRecordMap } from "./wordIdentity.js";

const USER_MARK_CONFIGS = {
  favorites: {
    recordsField: "favorites",
    updatedAtField: "favoritesUpdatedAt",
    resultRecordsKey: "favorites",
    resultUpdatedAtKey: "favoritesUpdatedAt"
  },
  difficults: {
    recordsField: "difficults",
    updatedAtField: "difficultsUpdatedAt",
    resultRecordsKey: "difficults",
    resultUpdatedAtKey: "difficultsUpdatedAt"
  }
};

async function loadUserMarksFromCloudRemote(db, collectionName, userUid) {
  try {
    const ref = doc(db, collectionName, userUid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data();
  } catch (error) {
    console.error("クラウド読み込み失敗:", error);
    throw error;
  }
}

export function subscribeUserMarksRealtimeRemote(db, collectionName, userUid, onChange) {
  const ref = doc(db, collectionName, userUid);
  return onSnapshot(ref, (snap) => onChange(snap));
}

async function saveUserMarksToCloudRemote(
  db,
  collectionName,
  userUid,
  recordsField,
  records,
  updatedAtField,
  updatedAt
) {
  return saveUserMarksPayloadToCloudRemote(db, collectionName, userUid, {
    [recordsField]: records,
    [updatedAtField]: updatedAt
  });
}

async function saveUserMarksPayloadToCloudRemote(db, collectionName, userUid, payload) {
  try {
    const ref = doc(db, collectionName, userUid);
    await setDoc(ref, payload, { merge: true });
  } catch (error) {
    console.error("クラウド保存失敗:", error);
    throw error;
  }
}

export async function saveFavoritesToCloudRemote(db, collectionName, userUid, favorites, favoritesUpdatedAt) {
  return saveUserMarksToCloudRemote(
    db,
    collectionName,
    userUid,
    USER_MARK_CONFIGS.favorites.recordsField,
    favorites,
    USER_MARK_CONFIGS.favorites.updatedAtField,
    favoritesUpdatedAt
  );
}

export async function saveDifficultsToCloudRemote(db, collectionName, userUid, difficults, difficultsUpdatedAt) {
  return saveUserMarksToCloudRemote(
    db,
    collectionName,
    userUid,
    USER_MARK_CONFIGS.difficults.recordsField,
    difficults,
    USER_MARK_CONFIGS.difficults.updatedAtField,
    difficultsUpdatedAt
  );
}

function normalizeFavoritesPayload(data) {
  return normalizeUserMarkPayload(data, USER_MARK_CONFIGS.favorites);
}

function normalizeDifficultsPayload(data) {
  return normalizeUserMarkPayload(data, USER_MARK_CONFIGS.difficults);
}

function getFavoritesUpdatedAt(data) {
  return getUserMarkUpdatedAt(data, USER_MARK_CONFIGS.favorites);
}

function getDifficultsUpdatedAt(data) {
  return getUserMarkUpdatedAt(data, USER_MARK_CONFIGS.difficults);
}

function normalizeUserMarkPayload(data, config) {
  return normalizeWordRecordMap(data?.[config.recordsField]);
}

function getUserMarkUpdatedAt(data, config) {
  return Number(data?.[config.updatedAtField]) || 0;
}

function hasRecords(records) {
  return Object.keys(records || {}).length > 0;
}

function hasPatch(patch) {
  return Object.keys(patch).length > 0;
}

function setSyncResult(result, config, records, updatedAt) {
  result[config.resultRecordsKey] = records;
  result[config.resultUpdatedAtKey] = updatedAt;
}

function setCloudPatch(cloudPatch, config, records, updatedAt) {
  cloudPatch[config.recordsField] = records;
  cloudPatch[config.updatedAtField] = updatedAt;
}

export async function syncUserMarksWithCloud(db, collectionName, userUid, localValues) {
  try {
    const data = await loadUserMarksFromCloudRemote(db, collectionName, userUid);
    const result = {};
    const cloudPatch = {};
    const syncStartedAt = Date.now();

    syncUserMarkType({
      data,
      localRecords: localValues.favorites,
      localUpdatedAt: localValues.favoritesUpdatedAt,
      config: USER_MARK_CONFIGS.favorites,
      normalizeCloudRecords: normalizeFavoritesPayload,
      getCloudUpdatedAt: getFavoritesUpdatedAt,
      result,
      cloudPatch,
      syncStartedAt
    });

    syncUserMarkType({
      data,
      localRecords: localValues.difficults,
      localUpdatedAt: localValues.difficultsUpdatedAt,
      config: USER_MARK_CONFIGS.difficults,
      normalizeCloudRecords: normalizeDifficultsPayload,
      getCloudUpdatedAt: getDifficultsUpdatedAt,
      result,
      cloudPatch,
      syncStartedAt
    });

    if (hasPatch(cloudPatch)) {
      await saveUserMarksPayloadToCloudRemote(db, collectionName, userUid, cloudPatch);
    }

    return result;
  } catch (error) {
    console.error("クラウド同期失敗:", error);
    throw error;
  }
}

function syncUserMarkType({
  data,
  localRecords,
  localUpdatedAt,
  config,
  normalizeCloudRecords,
  getCloudUpdatedAt,
  result,
  cloudPatch,
  syncStartedAt
}) {
  const records = localRecords || {};
  const updatedAt = Number(localUpdatedAt) || 0;

  if (!data) {
    if (hasRecords(records)) {
      const cloudUpdatedAt = syncStartedAt;
      setCloudPatch(cloudPatch, config, records, cloudUpdatedAt);
      setSyncResult(result, config, records, cloudUpdatedAt);
      return;
    }

    setSyncResult(result, config, records, updatedAt);
    return;
  }

  const cloudRecords = normalizeCloudRecords(data);
  const cloudUpdatedAt = getCloudUpdatedAt(data);

  if (cloudUpdatedAt >= updatedAt) {
    setSyncResult(result, config, cloudRecords, cloudUpdatedAt);
    return;
  }

  setCloudPatch(cloudPatch, config, records, updatedAt);
  setSyncResult(result, config, records, updatedAt);
}

function resolveUserMarkSnapshot({
  data,
  localUpdatedAt,
  normalizeCloudRecords,
  getCloudUpdatedAt,
  resultRecordsKey,
  resultUpdatedAtKey
}) {
  const cloudRecords = normalizeCloudRecords(data);
  const cloudUpdatedAt = getCloudUpdatedAt(data);

  if (cloudUpdatedAt <= localUpdatedAt) return null;

  return {
    [resultRecordsKey]: cloudRecords,
    [resultUpdatedAtKey]: cloudUpdatedAt
  };
}

export function resolveUserMarksSnapshot(snap, localValues) {
  if (!snap.exists()) {
    return {
      favoritesResult: null,
      difficultsResult: null
    };
  }

  const data = snap.data();

  return {
    favoritesResult: resolveUserMarkSnapshot({
      data,
      localUpdatedAt: localValues.favoritesUpdatedAt,
      normalizeCloudRecords: normalizeFavoritesPayload,
      getCloudUpdatedAt: getFavoritesUpdatedAt,
      resultRecordsKey: USER_MARK_CONFIGS.favorites.resultRecordsKey,
      resultUpdatedAtKey: USER_MARK_CONFIGS.favorites.resultUpdatedAtKey
    }),
    difficultsResult: resolveUserMarkSnapshot({
      data,
      localUpdatedAt: localValues.difficultsUpdatedAt,
      normalizeCloudRecords: normalizeDifficultsPayload,
      getCloudUpdatedAt: getDifficultsUpdatedAt,
      resultRecordsKey: USER_MARK_CONFIGS.difficults.resultRecordsKey,
      resultUpdatedAtKey: USER_MARK_CONFIGS.difficults.resultUpdatedAtKey
    })
  };
}
