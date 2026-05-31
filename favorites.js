import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js";

export async function loadFavoritesFromCloudRemote(db, collectionName, userUid) {
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

export function subscribeFavoritesRealtimeRemote(db, collectionName, userUid, onChange) {
  const ref = doc(db, collectionName, userUid);
  return onSnapshot(ref, (snap) => onChange(snap));
}

export async function saveFavoritesToCloudRemote(db, collectionName, userUid, favorites, favoritesUpdatedAt) {
  try {
    const ref = doc(db, collectionName, userUid);
    await setDoc(ref, { favorites, favoritesUpdatedAt }, { merge: true });
  } catch (error) {
    console.error("クラウド保存失敗:", error);
    throw error;
  }
}

export async function saveDifficultsToCloudRemote(db, collectionName, userUid, difficults, difficultsUpdatedAt) {
  try {
    const ref = doc(db, collectionName, userUid);
    await setDoc(ref, { difficults, difficultsUpdatedAt }, { merge: true });
  } catch (error) {
    console.error("クラウド保存失敗:", error);
    throw error;
  }
}

export function normalizeFavoritesPayload(data) {
  return data?.favorites && typeof data.favorites === "object" ? data.favorites : {};
}

export function normalizeDifficultsPayload(data) {
  return data?.difficults && typeof data.difficults === "object" ? data.difficults : {};
}

export function getFavoritesUpdatedAt(data) {
  return Number(data?.favoritesUpdatedAt) || 0;
}

export function getDifficultsUpdatedAt(data) {
  return Number(data?.difficultsUpdatedAt) || 0;
}

export async function syncFavoritesWithCloud(db, collectionName, userUid, localFavorites, localUpdatedAt) {
  try {
    const data = await loadFavoritesFromCloudRemote(db, collectionName, userUid);

    if (!data) {
      if (Object.keys(localFavorites).length > 0) {
        const updatedAt = Date.now();
        await saveFavoritesToCloudRemote(db, collectionName, userUid, localFavorites, updatedAt);
        return { favorites: localFavorites, favoritesUpdatedAt: updatedAt };
      }

      return { favorites: localFavorites, favoritesUpdatedAt: localUpdatedAt };
    }

    const cloudFavorites = normalizeFavoritesPayload(data);
    const cloudUpdatedAt = getFavoritesUpdatedAt(data);

    if (cloudUpdatedAt >= localUpdatedAt) {
      return { favorites: cloudFavorites, favoritesUpdatedAt: cloudUpdatedAt };
    }

    await saveFavoritesToCloudRemote(db, collectionName, userUid, localFavorites, localUpdatedAt);
    return { favorites: localFavorites, favoritesUpdatedAt: localUpdatedAt };
  } catch (error) {
    console.error("クラウド同期失敗:", error);
    throw error;
  }
}

export async function syncDifficultsWithCloud(db, collectionName, userUid, localDifficults, localUpdatedAt) {
  try {
    const data = await loadFavoritesFromCloudRemote(db, collectionName, userUid);

    if (!data) {
      if (Object.keys(localDifficults).length > 0) {
        const updatedAt = Date.now();
        await saveDifficultsToCloudRemote(db, collectionName, userUid, localDifficults, updatedAt);
        return { difficults: localDifficults, difficultsUpdatedAt: updatedAt };
      }

      return { difficults: localDifficults, difficultsUpdatedAt: localUpdatedAt };
    }

    const cloudDifficults = normalizeDifficultsPayload(data);
    const cloudUpdatedAt = getDifficultsUpdatedAt(data);

    if (cloudUpdatedAt >= localUpdatedAt) {
      return { difficults: cloudDifficults, difficultsUpdatedAt: cloudUpdatedAt };
    }

    await saveDifficultsToCloudRemote(db, collectionName, userUid, localDifficults, localUpdatedAt);
    return { difficults: localDifficults, difficultsUpdatedAt: localUpdatedAt };
  } catch (error) {
    console.error("クラウド同期失敗:", error);
    throw error;
  }
}

export function resolveFavoritesSnapshot(snap, localUpdatedAt) {
  if (!snap.exists()) return null;

  const data = snap.data();
  const cloudFavorites = normalizeFavoritesPayload(data);
  const cloudUpdatedAt = getFavoritesUpdatedAt(data);

  if (cloudUpdatedAt <= localUpdatedAt) return null;

  return {
    favorites: cloudFavorites,
    favoritesUpdatedAt: cloudUpdatedAt
  };
}

export function resolveDifficultsSnapshot(snap, localUpdatedAt) {
  if (!snap.exists()) return null;

  const data = snap.data();
  const cloudDifficults = normalizeDifficultsPayload(data);
  const cloudUpdatedAt = getDifficultsUpdatedAt(data);

  if (cloudUpdatedAt <= localUpdatedAt) return null;

  return {
    difficults: cloudDifficults,
    difficultsUpdatedAt: cloudUpdatedAt
  };
}
