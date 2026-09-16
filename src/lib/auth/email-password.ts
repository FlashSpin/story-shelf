/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * Enabled so Vercel (and other non–Grok-sandbox hosts) can sign in without
 * `GROK_AUTH_*` credentials. The preview Google/X broker client only accepts
 * `*.grok-sandbox.com` callbacks; email/password uses this app's own Better Auth.
 *
 * Forms: `authClient.signUp.email` / `authClient.signIn.email` from
 * `@/lib/auth/client` (see the auth skill).
 *
 * Do NOT edit `server.ts` for this — that file is frozen pre-wired config.
 */
export const emailAndPasswordEnabled = true;
