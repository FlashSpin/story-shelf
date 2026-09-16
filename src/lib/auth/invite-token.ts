/**
 * Invite token minting / hashing (dependency-free — safe for unit tests).
 */
import { createHash, randomBytes } from "node:crypto";

/** Header the invite accept page sends so the signup gate can verify the token. */
export const INVITE_TOKEN_HEADER = "x-shelf-invite-token";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Cryptographically strong URL-safe token (~256 bits). */
export function mintInviteToken(): string {
  return randomBytes(32).toString("base64url");
}
