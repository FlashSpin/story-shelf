/** Shared invite constants (no Node APIs — safe for route/SSR + client). */

/** Header the invite accept page sends so the signup gate can verify the token. */
export const INVITE_TOKEN_HEADER = "x-shelf-invite-token";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
