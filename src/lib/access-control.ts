export const appRoles = ["artist", "producer", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && appRoles.includes(value as AppRole);
}

export function hasRole(roles: readonly AppRole[], requiredRole: AppRole) {
  return roles.includes(requiredRole);
}
