# Story Shelf

A shared family catalog of kids’ books already at home. Browse the shelf without
an account; allowlisted signed-in editors can add titles, upload cover photos,
edit notes, or remove books — so the next gift is a new story, not a duplicate.

## Features

- Browse the family shelf (title / author / ISBN search)
- **Gift check** (`/check`) — guests ask “Already on Raffy’s shelf?” with one
  clear owned / wishlist / not-on-shelf card (Amazon or bookshop URL, ISBN, or
  title; barcode scan when the browser supports it). Links without an ISBN get
  a clear error — never a false “great gift idea.”
- **Recently added** strip near the top of the home shelf (newest covers)
- **Wishlist** (`/wishlist`) for gift ideas not owned yet — guests browse;
  editors add / remove / move onto the owned shelf
- Add books via catalog search (Open Library + Google Books), ISBN / barcode
  scan, or manual entry
- Optional cover photo upload (camera or file)
- Short shelf notes per book
- Guest browse is read-only; mutations require an editor session (env bootstrap
  or invited); catalog proxies require sign-in
- Editors can create copy-paste invite links (`/invite/<token>`) for new editors

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
| `SHELF_EDITOR_EMAILS` | Bootstrap editor emails (case-insensitive, trimmed). **Fail closed** with no env and no invited `shelf_editors` rows. Invited editors are stored in the DB after they accept a link — they do not need to stay on this list. |
| `GROK_AUTH_CLIENT_ID` / `GROK_AUTH_CLIENT_SECRET` | Optional. Injected by the **Grok deployer** for Google/X via `auth.grok.me`. Not available for manual Vercel deploys; without them, use email/password on `/login`. The baked preview client only works for `*.grok-sandbox.com`. |
| `GROK_PROJECT_ID` | Set by the Grok deploy platform; absence means workspace preview. |
| `BLOB_READ_WRITE_TOKEN` | **Required on Vercel for cover photo uploads.** Read-write token from a **public** Vercel Blob store (Storage → Blob). Without it, new uploads fall back to storing data URLs in Postgres (`cover_data`) — fine locally, not for production scale. Guests only need the public HTTPS URL; they never write. |

### Vercel sign-in (email/password — no `GROK_AUTH_*`)

Google/X on Vercel fail with Invalid origin / localhost callback unless a
production Grok auth client is injected. **Preferred long-term path:** deploy
via the Grok platform so it injects `GROK_AUTH_CLIENT_ID` /
`GROK_AUTH_CLIENT_SECRET`.

**Vercel fallback:** Better Auth **email/password is editors-only** — no open
signup. A server gate rejects `/sign-up/email`, `/sign-in/email`, and password
reset unless the email is in `SHELF_EDITOR_EMAILS`, already in `shelf_editors`,
or (sign-up only) presents a valid invite token. `/login` is sign-in only;
new editors accept an invite at `/invite/<token>`.

1. In Vercel → **Settings** → **Environment Variables**, set at least:
   - `BETTER_AUTH_URL` = `https://story-shelf-six.vercel.app` (no trailing slash)
   - `BETTER_AUTH_SECRET` = a long random string (e.g. `openssl rand -hex 32`)
   - `SHELF_EDITOR_EMAILS` = `Mccarlton95@gmail.com`
   - `DATABASE_URL` = a Neon (or other Postgres) connection string
   - `BLOB_READ_WRITE_TOKEN` = from Vercel Storage → Blob (public store; see Cover storage)
2. Do **not** set `VITE_AUTH_ENABLED=false` on Production.
3. Redeploy after changing env vars.
4. Open `/login` → **Sign in** with `Mccarlton95@gmail.com` and the password
   already set for that bootstrap account. That unlocks Add book and
   **Invite editor**.
5. To add another editor: signed-in editor → **Invite editor** → enter their
   email → copy the `/invite/<token>` link → they create their account on that
   page. Invites are single-use and expire in 7 days.

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

Invited editors live in `shelf_editors` (migration `0004_editor_invites.sql`).
`SHELF_EDITOR_EMAILS` remains the bootstrap for the first editor only.

Wishlist gift ideas live in `wishlist_items` (migration `0005_wishlist.sql`).
Adding an owned book with a matching ISBN clears that wishlist row; editors can
also **Move to shelf** from a wishlist card.

Local scripts (`npm run dev` / `build` / `preview`) load `VITE_*` keys from
`.grok/app-env.json` via `scripts/with-app-env.mjs` when that file exists.
Do not commit secrets in `.env` — keep using platform-injected env in deploy.

## Auth model

- **Public:** `listBooks`, `listWishlist`, book detail cover fetch (`getBookCover`),
  browsing UI, `previewEditorInvite` (token validation only)
- **Signed-in:** `searchCatalog`, `lookupIsbn` (catalog proxies)
- **Editors** (env bootstrap **or** `shelf_editors` after invite): `addBook`,
  `updateBook`, `updateCover`, `removeBook`, `addWishlistItem`,
  `removeWishlistItem`, `moveWishlistToShelf`, `createEditorInvite`
- Invite accept: `/invite/$token` → email/password sign-up with
  `x-shelf-invite-token`; server verifies the token before granting editor
- The home page gates “Add book” / “Invite editor” behind editor access; guests
  stay browse-only.

## Develop

```bash
npm install
npm run dev          # http://0.0.0.0:8080
npm run typecheck
npm test
npm run build        # vite build + db:migrate when DATABASE_URL is set
```

## Cover storage (Vercel Blob)

**Preferred on Vercel:** camera / file uploads go to a **public** [Vercel Blob](https://vercel.com/docs/vercel-blob)
store via `@vercel/blob` (`put` on the server). The HTTPS blob URL is saved on
`books.cover_url` (same column as catalog covers) and returned in `listBooks` —
no multi‑hundred‑KB base64 in Postgres for new uploads.

### Env for Skip / Vercel

1. Vercel project → **Storage** → create a **Blob** store with **public** access
   (guests must be able to load cover images by URL).
2. Connect the store to Production (and Preview if desired). Vercel injects:
   - `BLOB_READ_WRITE_TOKEN` — **set this** (required for uploads outside OIDC /
     when the SDK needs a static token; always safe to keep on the server only)
   - Optionally `BLOB_STORE_ID` + runtime OIDC on Vercel (SDK prefers OIDC when
     present; we still pass `BLOB_READ_WRITE_TOKEN` explicitly for Nitro/Vite)
3. Redeploy after the env var is present.
4. **Never** expose `BLOB_READ_WRITE_TOKEN` to the browser (`VITE_*`). Uploads
   run only in editor-gated server functions (`addBook`, `updateCover`).

### Behaviour

| Source | Storage | List / guest read |
| --- | --- | --- |
| Open Library / Google catalog | `cover_url` (HTTPS) | Yes |
| New editor upload (Blob configured) | Vercel Blob → `cover_url` (HTTPS); `cover_data` cleared | Yes |
| Legacy upload (already in DB) | `cover_data` (data URL) | Detail only via `getBookCover` |
| Local / no `BLOB_READ_WRITE_TOKEN` | Fallback: `cover_data` data URL | Detail only |

Wishlist rows keep catalog HTTPS URLs in `cover_url` (no photo-upload UI today).
Auth: only shelf editors may upload; guests may load public cover HTTPS URLs.
Uploads are validated as JPEG/PNG/WebP and size-capped (~350 KB decoded).

### Alternative (S3 / R2)

If Blob is unavailable, point the same server helper at S3-compatible storage
(R2/S3) and store the resulting HTTPS URL in `cover_url`. Document bucket public
read + private write credentials as env vars instead of `BLOB_READ_WRITE_TOKEN`.
Vercel Blob is the lowest-friction path for this Nitro/Vercel deploy.

## Security headers

`vercel.json` sets `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, and
`Content-Security-Policy: frame-ancestors 'none'`. A fuller CSP was deferred so
Google Fonts and existing scripts keep working.

## Repo hygiene

See [HYGIENE.md](./HYGIENE.md) for scaffold paths safe to delete (`.grok/` skills,
empty lock stubs, etc.).
