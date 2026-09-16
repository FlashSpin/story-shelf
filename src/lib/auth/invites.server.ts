/**
 * Copy-paste editor invites.
 *
 * Raw token (unguessable) is returned once to the creator; only sha256(token)
 * is stored. Invites are bound to an email, single-use, and expire (default 7d).
 */
import { randomUUID } from "node:crypto";
import { getSql } from "../db";
import {
  hashInviteToken,
  INVITE_TOKEN_HEADER,
  INVITE_TTL_MS,
  mintInviteToken,
} from "./invite-token";
import { upsertShelfEditor } from "./shelf-editors.server";

export {
  hashInviteToken,
  INVITE_TOKEN_HEADER,
  INVITE_TTL_MS,
  mintInviteToken,
};

export type InvitePreview = {
  email: string;
  expiresAt: string;
};

export type CreatedInvite = {
  token: string;
  path: string;
  email: string;
  expiresAt: string;
};

type InviteRow = {
  id: string;
  token_hash: string;
  email: string;
  created_by_user_id: string;
  created_by_email: string;
  created_at: Date | string;
  expires_at: Date | string;
  used_at: Date | string | null;
  used_by_user_id: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function isExpired(expiresAt: Date | string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= now;
}

export async function createEditorInvite(params: {
  email: string;
  createdByUserId: string;
  createdByEmail: string;
  ttlMs?: number;
}): Promise<CreatedInvite> {
  const email = normalizeEmail(params.email);
  if (!email || !email.includes("@")) {
    throw new Error("A valid invitee email is required");
  }
  const token = mintInviteToken();
  const tokenHash = hashInviteToken(token);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + (params.ttlMs ?? INVITE_TTL_MS));

  const sql = await getSql();
  await sql`
    insert into shelf_editor_invites (
      id, token_hash, email, created_by_user_id, created_by_email, expires_at
    ) values (
      ${id},
      ${tokenHash},
      ${email},
      ${params.createdByUserId},
      ${normalizeEmail(params.createdByEmail)},
      ${expiresAt.toISOString()}
    )
  `;

  return {
    token,
    path: `/invite/${token}`,
    email,
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Load a still-valid (unused, unexpired) invite by raw token.
 * Returns null on any failure (fail closed — do not leak why).
 */
export async function findValidInviteByToken(
  rawToken: string | null | undefined,
): Promise<InviteRow | null> {
  if (!rawToken?.trim()) return null;
  const tokenHash = hashInviteToken(rawToken.trim());
  const sql = await getSql();
  const rows = await sql<InviteRow>`
    select
      id, token_hash, email, created_by_user_id, created_by_email,
      created_at, expires_at, used_at, used_by_user_id
    from shelf_editor_invites
    where token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.used_at) return null;
  if (isExpired(row.expires_at)) return null;
  return row;
}

/** Public preview for the accept page — email + expiry only when valid. */
export async function previewInvite(
  rawToken: string,
): Promise<InvitePreview | null> {
  const invite = await findValidInviteByToken(rawToken);
  if (!invite) return null;
  return {
    email: invite.email,
    expiresAt: asIso(invite.expires_at),
  };
}

/**
 * True when the raw token is a valid unused invite for `email`
 * (used by the Better Auth signup gate).
 */
export async function isValidInviteForEmail(
  rawToken: string | null | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!email?.trim()) return false;
  const invite = await findValidInviteByToken(rawToken);
  if (!invite) return false;
  return invite.email === normalizeEmail(email);
}

/**
 * Mark invite used (single-use) and grant DB editor membership.
 * Returns false if the invite was already used / expired / missing (fail closed).
 */
export async function consumeInviteForUser(params: {
  rawToken: string;
  email: string;
  userId: string;
}): Promise<boolean> {
  const email = normalizeEmail(params.email);
  const tokenHash = hashInviteToken(params.rawToken.trim());
  const sql = await getSql();

  const updated = await sql<InviteRow>`
    update shelf_editor_invites
    set used_at = now(), used_by_user_id = ${params.userId}
    where token_hash = ${tokenHash}
      and email = ${email}
      and used_at is null
      and expires_at > now()
    returning
      id, token_hash, email, created_by_user_id, created_by_email,
      created_at, expires_at, used_at, used_by_user_id
  `;

  const invite = updated[0];
  if (!invite) return false;

  await upsertShelfEditor({
    email: invite.email,
    userId: params.userId,
    createdByEmail: invite.created_by_email,
  });
  return true;
}
