/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Enabled as a Vercel fallback when `GROK_AUTH_*` is unavailable. The preview
 * Google/X broker client only accepts `*.grok-sandbox.com` callbacks.
 *
 * **Editors only — no open signup.** Server gate
 * (`email-password-gate.server.ts`) rejects `/sign-up/email`, `/sign-in/email`,
 * and password-reset for any email not in `SHELF_EDITOR_EMAILS`. Prefer the
 * Grok deployer (production `GROK_AUTH_CLIENT_*`) for Google/X long-term.
 *
 * Forms: `authClient.signUp.email` / `authClient.signIn.email` from
 * `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT rewrite `server.ts` beyond wiring the editor gate plugin.
 */
export const emailAndPasswordEnabled = true;
