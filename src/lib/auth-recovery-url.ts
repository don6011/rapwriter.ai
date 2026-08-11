export const AUTH_RECOVERY_EVENT = "rapwriter:auth-recovery";

export type RecoveryHashSession = {
  accessToken: string;
  refreshToken: string;
};

export function recoverySessionFromHash(hash: string): RecoveryHashSession | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  if (params.get("type") !== "recovery") return null;

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;

  return { accessToken, refreshToken };
}

export function recoveryModeUrl(href: string) {
  const url = new URL(href);
  url.hash = "";
  url.searchParams.set("auth_mode", "recovery");
  return `${url.pathname}${url.search}`;
}
