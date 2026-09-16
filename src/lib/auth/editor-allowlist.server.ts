/**
 * Shelf editor env bootstrap: `SHELF_EDITOR_EMAILS` comma-separated emails.
 *
 * Fail-closed for the env gate alone: unset or empty → nobody via env.
 * Invited editors are granted via `shelf_editors` (see shelf-editors.server.ts);
 * use `isShelfEditor` / `assertShelfEditor` for the full membership check.
 *
 * Guests and signed-in users who are neither allowlisted nor DB members stay
 * read-only.
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
 * True when `email` is on the env allowlist. Empty allowlist → always false
 * (fail closed for env). Null/blank email → false.
 *
 * Does NOT check invited DB members — use `isShelfEditor` for that.
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
 * Throw 403 unless the session email is on the env allowlist.
 * Prefer `assertShelfEditor` (env + DB) for mutation gates.
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
