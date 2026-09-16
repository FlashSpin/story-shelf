# Story Shelf

A shared family catalog of kids’ books already at home. Browse the shelf without
an account; allowlisted signed-in editors can add titles, upload cover photos,
edit notes, or remove books — so the next gift is a new story, not a duplicate.

## Features

- Browse and filter the family shelf (age band, title / author / ISBN search)
- Add books via catalog search (Open Library + Google Books), ISBN / barcode
  scan, or manual entry
- Optional cover photo upload (camera or file)
- Age band + short shelf notes per book
- Guest browse is read-only; mutations require an allowlisted editor session;
  catalog proxies require sign-in

## Stack

- **UI:** React 19, TanStack Router / Start / Query, Tailwind CSS 4
- **Auth:** Better Auth (`VITE_AUTH_ENABLED`)
- **DB:** Neon Postgres when `DATABASE_URL` is set; embedded PGLite otherwise
- **Migrations:** `migrations/*.sql` (applied on deploy via `npm run db:migrate`,
  and on PGLite startup)

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon (or other Postgres) connection string. **Required on Vercel** for durable books + auth sessions. If unset, the app uses ephemeral PGLite (fine locally; unreliable on serverless). |
| `VITE_AUTH_ENABLED` | Set to `"false"` to disable sign-in UI and use the shared dev user (local/preview only). Omit or any other value → auth on. Deploy typically injects `"true"`. |
| `BETTER_AUTH_URL` | Public app origin, e.g. `https://story-shelf-six.vercel.app`. Required on Vercel so Better Auth trusts the origin (avoids "Invalid origin"). |
| `BETTER_AUTH_SECRET` | Long random secret that signs sessions. **Required on Vercel** so every serverless instance shares the same secret. |
| `SHELF_EDITOR_EMAILS` | Comma-separated editor emails (case-insensitive, trimmed). **Fail closed:** unset or empty → no one can mutate the shelf when auth is on. Guests and non-listed signed-in users stay read-only. |
| `GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET` | Optional. Injected by the **Grok deployer** for Google/X via `auth.grok.me`. Not available for manual Vercel deploys; without them, use email/password on `/login`. The baked preview client only works for `*.grok-sandbox.com`. |
| `GROK_PROJECT_ID` | Set by the Grok deploy platform; absence means workspace preview. |

### Vercel sign-in (email/password — no `GROK_AUTH_*`)

Google/X on Vercel fail with Invalid origin / localhost callback unless a
production Grok auth client is injected. This app enables **Better Auth
email/password** so an editor can sign up / sign in without those credentials.

1. In Vercel → **Settings** → **Environment Variables**, set at least:
   - `BETTER_AUTH_URL` = `https://story-shelf-six.vercel.app` (no trailing slash)
   - `BETTER_AUTH_SECRET` = a long random string (e.g. `openssl rand -hex 32`)
   - `SHELF_EDITOR_EMAILS` = `Mccarlton95@gmail.com`
   - `DATABASE_URL` = a Neon (or other Postgres) connection string
2. Do **not** set `VITE_AUTH_ENABLED=false` on Production.
3. Redeploy after changing env vars.
4. Open `/login` → **Create account** (first time) or **Sign in** with
   `Mccarlton95@gmail.com` and a password of 8+ characters. The allowlist
   matches that email (case-insensitive) so Add book unlocks.

**Blocker without `DATABASE_URL`:** Vercel serverless + PGLite-only means users,
sessions, and books do not survive across instances/cold starts. Provision Neon
(or another Postgres) and set `DATABASE_URL`, then ensure `npm run build` runs
`db:migrate` (already part of the build script).

### Setting `SHELF_EDITOR_EMAILS` on Vercel

1. Open the project → **Settings** → **Environment Variables**.
2. Add `SHELF_EDITOR_EMAILS` for Production (and Preview if you want editors there).
3. Value example: `Mccarlton95@gmail.com` (or comma-separated list)
4. Redeploy so server functions pick up the new value.

### Grok deployer path for Google/X (`GROK_AUTH_*`)

When the app is deployed **through the Grok platform**, the deployer injects a
per-app `GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET` (plus `DATABASE_URL` /
`BETTER_AUTH_*`). Manual Vercel deploys do not receive those secrets; the preview
client in `src/lib/auth/preview.ts` only works for `*.grok-sandbox.com`. There is
no supported way for the end user to mint production broker credentials — use
email/password on Vercel, or redeploy via Grok if Google/X is required.

Local auth-off mode (`VITE_AUTH_ENABLED=false` without `DATABASE_URL`) still allows
the shared DEV_USER to mutate for local PGLite work. Production with auth on
always enforces the allowlist.

Future: invite codes / a membership table can replace this env gate — v1 is
env-only (no invite UI).

Local scripts (`npm run dev` / `build` / `preview`) load `VITE_*` keys from
`.grok/app-env.json` via `scripts/with-app-env.mjs` when that file exists.
Do not commit secrets in `.env` — keep using platform-injected env in deploy.

## Auth model

- **Public:** `listBooks`, book detail cover fetch (`getBookCover`), browsing UI
- **Signed-in:** `searchCatalog`, `lookupIsbn` (catalog proxies)
- **Allowlisted editors:** `addBook`, `updateBook`, `updateCover`, `removeBook`
- The home page gates “Add book” behind editor access; guests and non-editors are
  not expected to call mutations. If you add a public browse path later, keep it
  read-only and do **not** call `searchCatalog` / `lookupIsbn` without a session.

## Develop

```bash
npm install
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm test
npm run build        # vite build + db:migrate when DATABASE_URL is set
```

## Cover storage (stopgap)

HTTPS catalog covers stay in `books.cover_url` and are returned in list payloads.
Camera / file uploads are stored in `books.cover_data` and omitted from
`listBooks` (detail loads them via `getBookCover`). This avoids multi‑hundred‑KB
data URLs on every shelf load until a real blob store is wired up.

## Security headers

`vercel.json` sets `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and
`Content-Security-Policy: frame-ancestors 'none'`. A fuller CSP was deferred so
Google Fonts and existing scripts keep working.

## Repo hygiene

See [HYGIENE.md](./HYGIENE.md) for scaffold paths safe to delete (`.grok/` skills,
empty lock stubs, etc.).
