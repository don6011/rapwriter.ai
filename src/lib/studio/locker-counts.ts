export type LockerCountSnapshot = {
  beats: number;
  songs: number;
  hooks: number;
};

export type LockerCollectionSnapshot = LockerCountSnapshot & {
  roughTakes: number;
  ownedItems: number;
};

export function lockerBeatCount(ownedBeatIds: readonly string[], includedBeatIds: readonly string[]) {
  return new Set([...ownedBeatIds, ...includedBeatIds]).size;
}

export function lockerSavedItemCount({ beats, songs, hooks }: LockerCountSnapshot) {
  return beats + songs + hooks;
}

export function lockerCollectionCount({ beats, songs, hooks, roughTakes, ownedItems }: LockerCollectionSnapshot) {
  return beats + songs + hooks + roughTakes + ownedItems;
}
