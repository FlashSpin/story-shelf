/**
 * Shelf editor allowlist (v1): `SHELF_EDITOR_EMAILS` comma-separated emails.
 *
 * Fail-closed: unset or empty → nobody may mutate the shelf when auth is on.
 * Guests and signed-in users whose email is not listed stay read-only.
 *
 * Future: replace this env gate with invite codes / a `shelf_members`
 * (email + role) table — no invite UI in this pass.
 */

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Parse a raw env-style allowlist string into a lowercased email set. */
export function parseShelfEditorEmails(raw: string | undefined | null): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function shelfEditorEmailsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Set<string> {
  return parseShelfEditorEmails(env.SHELF_EDITOR_EMAILS);
}

/**
 * True when `email` is on the allowlist. Empty allowlist → always false
 * (fail closed). Null/blank email → false.
 */
export function isShelfEditorEmail(
  email: string | null | undefined,
  allowlist: Set<string> = shelfEditorEmailsFromEnv(),
): boolean {
  if (allowlist.size === 0) return false;
  if (!email?.trim()) return false;
  return allowlist.has(email.trim().toLowerCase());
}

/**
 * Throw 403 unless the session email is allowlisted.
 * Call only after authMiddleware (signed-in path).
 */
export function assertShelfEditorEmail(email: string | null | undefined): void {
  const allowlist = shelfEditorEmailsFromEnv();
  if (allowlist.size === 0) {
    throw new ForbiddenError(
      "Forbidden: no shelf editors configured (set SHELF_EDITOR_EMAILS)",
    );
  }
  if (!isShelfEditorEmail(email, allowlist)) {
    throw new ForbiddenError("Forbidden: not a shelf editor");
  }
}
