export const AUTH_USERNAMES = [
  'z0x4',
  'kona67',
] as const;

export const AUTH_AUTO_LOCK_MS =
  3 * 60 * 1_000 + 33 * 1_000;

export type AuthUsername =
  typeof AUTH_USERNAMES[number];
