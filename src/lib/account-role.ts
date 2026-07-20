export const accountTypes = ["artist", "producer", "artist_producer", "admin"] as const;

export type AccountType = (typeof accountTypes)[number];
export type OnboardingAccountType = Exclude<AccountType, "admin">;

export function hasProducerWorkspace(accountType?: AccountType | null) {
  return accountType === "producer" || accountType === "artist_producer" || accountType === "admin";
}

export function hasArtistWorkspace(accountType?: AccountType | null) {
  return accountType === "artist" || accountType === "artist_producer" || accountType === "admin";
}

export function accountTypeLabel(accountType?: AccountType | null) {
  if (accountType === "producer") return "Producer account";
  if (accountType === "artist_producer") return "Artist + Producer";
  if (accountType === "admin") return "Owner account";
  return "Artist profile";
}

export function producerUpgradeAccountType(accountType?: AccountType | null): AccountType {
  if (accountType === "admin") return "admin";
  if (accountType === "producer" || accountType === "artist_producer") return accountType;
  return "artist_producer";
}
