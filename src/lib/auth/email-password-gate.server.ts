/**
 * Restrict Better Auth email/password to shelf editors.
 *
 * No open signup:
 * - Sign-in / password-reset: env allowlist OR `shelf_editors` DB members
 * - Sign-up: env allowlist (bootstrap first-time setup on /login) OR a valid
 *   unused invite token (`x-shelf-invite-token`) bound to the signup email
 *
 * After a successful invite signup, the after-hook consumes the invite and
 * inserts `shelf_editors` so later sign-ins work without the env list.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { isShelfEditorEmail } from "./editor-allowlist.server.ts";
import { INVITE_TOKEN_HEADER } from "./invite-token.ts";

/** Paths that accept an email body and must be editor-gated. */
export const EMAIL_PASSWORD_GATED_PATHS = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
] as const;

export type EmailPasswordGatedPath =
  (typeof EMAIL_PASSWORD_GATED_PATHS)[number];

export function isEmailPasswordGatedPath(
  path: string | undefined,
): path is EmailPasswordGatedPath {
  return (
    typeof path === "string" &&
    (EMAIL_PASSWORD_GATED_PATHS as readonly string[]).includes(path)
  );
}

function emailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

function inviteTokenFromHeaders(
  headers: Headers | { get?: (name: string) => string | null } | undefined | null,
): string | null {
  if (!headers || typeof headers.get !== "function") return null;
  const raw = headers.get(INVITE_TOKEN_HEADER);
  return raw?.trim() ? raw.trim() : null;
}

function inviteTokenFromCtx(ctx: {
  headers?: Headers;
  request?: Request;
}): string | null {
  return (
    inviteTokenFromHeaders(ctx.headers) ??
    inviteTokenFromHeaders(ctx.request?.headers)
  );
}

/**
 * Env-only gate (unit-test friendly). Prefer `assertEmailPasswordAccess` for
 * full env + DB + invite checks at runtime.
 */
export function assertEmailPasswordEditorEmail(
  email: string | null | undefined,
): void {
  if (!isShelfEditorEmail(email)) {
    throw new APIError("FORBIDDEN", {
      message: "Email sign-in is limited to shelf editors.",
    });
  }
}

/**
 * Full gate: env allowlist, DB members, or (sign-up only) a valid invite token.
 * DB / invite modules are loaded lazily so unit tests of the sync helper stay light.
 */
export async function assertEmailPasswordAccess(params: {
  path: string;
  email: string | null | undefined;
  inviteToken?: string | null;
}): Promise<void> {
  const { path, email, inviteToken } = params;

  if (path === "/sign-up/email") {
    if (isShelfEditorEmail(email)) return;
    const { isValidInviteForEmail } = await import("./invites.server.ts");
    if (await isValidInviteForEmail(inviteToken, email)) return;
    throw new APIError("FORBIDDEN", {
      message:
        "Email sign-up requires a valid editor invite or an allowlisted email.",
    });
  }

  const { isShelfEditor } = await import("./shelf-editors.server.ts");
  if (await isShelfEditor(email)) return;
  throw new APIError("FORBIDDEN", {
    message: "Email sign-in is limited to shelf editors.",
  });
}

async function userIdAfterSignUp(ctx: {
  context?: { returned?: unknown };
  body?: unknown;
}): Promise<string | null> {
  const returned = ctx.context?.returned;
  if (!returned) return null;
  let payload: unknown = returned;
  if (returned instanceof Response) {
    if (returned.status < 200 || returned.status >= 300) return null;
    try {
      payload = await returned.clone().json();
    } catch {
      return null;
    }
  }
  if (
    payload &&
    typeof payload === "object" &&
    "status" in payload &&
    typeof (payload as { status?: unknown }).status === "string"
  ) {
    return null;
  }
  if (payload && typeof payload === "object") {
    const user = (payload as { user?: { id?: unknown } }).user;
    if (user && typeof user.id === "string") return user.id;
  }
  const email = emailFromBody(ctx.body)?.trim().toLowerCase();
  if (!email) return null;
  const { getSql } = await import("../db.ts");
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from "user" where email = ${email} limit 1
  `;
  return rows[0]?.id ?? null;
}

/**
 * Better Auth plugin: reject email/password auth for non-editors;
 * consume invites after successful invite signup.
 */
export function emailPasswordEditorGate(): BetterAuthPlugin {
  return {
    id: "shelf-email-password-editor-gate",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) =>
            isEmailPasswordGatedPath(ctx.path),
          handler: createAuthMiddleware(async (ctx) => {
            await assertEmailPasswordAccess({
              path: ctx.path as string,
              email: emailFromBody(ctx.body),
              inviteToken: inviteTokenFromCtx(ctx),
            });
          }),
        },
      ],
      after: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const inviteToken = inviteTokenFromCtx(ctx);
            if (!inviteToken) return;
            const email = emailFromBody(ctx.body);
            const userId = await userIdAfterSignUp(ctx);
            if (!email || !userId) return;
            const { consumeInviteForUser } = await import("./invites.server.ts");
            await consumeInviteForUser({
              rawToken: inviteToken,
              email,
              userId,
            });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
