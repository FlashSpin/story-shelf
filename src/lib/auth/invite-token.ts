/**
 * Invite token minting / hashing (Node crypto — server/tests only).
 */
import { createHash, randomBytes } from "node:crypto";

export {
  INVITE_TOKEN_HEADER,
  INVITE_TTL_MS,
} from "./invite-constants";

export function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/** Cryptographically strong URL-safe token (~256 bits). */
export function mintInviteToken(): string {
  return randomBytes(32).toString("base64url");
}
