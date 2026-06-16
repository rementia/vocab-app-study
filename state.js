export const volOrder = ["vol1", "vol2", "vol3", "vol4"];
export const USER_MARKS_COLLECTION = "privateUsers";

export function createInitialWordsByVol() {
  return Object.fromEntries(volOrder.map((vol) => [vol, []]));
}

export function createInitialIndexByVol() {
  return {
    ...Object.fromEntries(volOrder.map((vol) => [vol, 0])),
    favorites: 0,
    difficults: 0
  };
}
