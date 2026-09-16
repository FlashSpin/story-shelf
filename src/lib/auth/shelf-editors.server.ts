/**
 * Shelf editor membership: env bootstrap (`SHELF_EDITOR_EMAILS`) OR
 * `shelf_editors` rows created when an invite is accepted.
 *
 * Fail closed: neither env nor DB membership → not an editor.
 */
import { getSql } from "../db";
import {
  ForbiddenError,
  isShelfEditorEmail,
  shelfEditorEmailsFromEnv,
} from "./editor-allowlist.server";

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

/** True when email is a DB member (invited editor who completed setup). */
export async function isDbShelfEditor(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const sql = await getSql();
  const rows = await sql<{ email: string }>`
    select email from shelf_editors where email = ${normalized} limit 1
  `;
  return rows.length > 0;
}

/**
 * Editor if on env allowlist OR in `shelf_editors`.
 * Empty env alone does not block DB members; missing both → false.
 */
export async function isShelfEditor(
  email: string | null | undefined,
): Promise<boolean> {
  if (isShelfEditorEmail(email, shelfEditorEmailsFromEnv())) return true;
  return isDbShelfEditor(email);
}

/**
 * Throw 403 unless the session email is an editor (env or DB).
 * Call only after authMiddleware (signed-in path).
 */
export async function assertShelfEditor(
  email: string | null | undefined,
): Promise<void> {
  if (await isShelfEditor(email)) return;

  const allowlist = shelfEditorEmailsFromEnv();
  if (allowlist.size === 0) {
    // Still fail closed when neither bootstrap nor any chance of DB membership
    // for this email — keep a clear message when env is unset.
    throw new ForbiddenError(
      "Forbidden: not a shelf editor (set SHELF_EDITOR_EMAILS or accept an invite)",
    );
  }
  throw new ForbiddenError("Forbidden: not a shelf editor");
}

/** Insert or refresh a DB editor row after invite acceptance. */
export async function upsertShelfEditor(params: {
  email: string;
  userId: string;
  createdByEmail: string | null;
}): Promise<void> {
  const email = normalizeEmail(params.email);
  if (!email) throw new Error("Editor email required");
  const sql = await getSql();
  await sql`
    insert into shelf_editors (email, user_id, created_by_email)
    values (${email}, ${params.userId}, ${params.createdByEmail})
    on conflict (email) do update set
      user_id = excluded.user_id,
      created_by_email = coalesce(shelf_editors.created_by_email, excluded.created_by_email)
  `;
}
