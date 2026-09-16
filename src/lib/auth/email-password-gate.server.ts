/**
 * Restrict Better Auth email/password to SHELF_EDITOR_EMAILS.
 *
 * No open signup: only allowlisted editor emails may hit /sign-up/email,
 * /sign-in/email, or /request-password-reset. Long-term Google/X still goes
 * through the Grok deployer (`GROK_AUTH_*`); this gate is the Vercel fallback.
 */
import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { isShelfEditorEmail } from "./editor-allowlist.server.ts";

/** Paths that accept an email body and must be editor-allowlisted. */
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

/**
 * Pure gate used by the plugin (and unit tests).
 * Empty allowlist → always reject (fail closed).
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

function emailFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? email : null;
}

/**
 * Better Auth plugin: reject email/password auth for non-allowlisted emails.
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
            assertEmailPasswordEditorEmail(emailFromBody(ctx.body));
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
