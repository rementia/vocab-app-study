export const volOrder = ["vol1", "vol2", "vol3", "vol4"];
export const FAVORITES_COLLECTION = "privateUsers";

export function createInitialWordsByVol() {
  return {
    vol1: [],
    vol2: [],
    vol3: [],
    vol4: []
  };
}

export function createInitialIndexByVol() {
  return {
    vol1: 0,
    vol2: 0,
    vol3: 0,
    vol4: 0,
    favorites: 0,
    difficults: 0
  };
}
