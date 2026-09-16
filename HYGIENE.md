# Repo hygiene

Scaffold leftovers from the app-builder / Grok workspace that are safe to remove
locally (or in a follow-up PR). Prefer documenting large trees here instead of
shipping a huge delete patch.

## Delete in this patch

- `.node_modules.lock` — empty stub
- `.project_id` — unused workspace id file (runtime uses `GROK_PROJECT_ID` env)

## Delete manually (large / optional)

The `.grok/` tree (~100+ skill/reference files) is platform scaffold. It is
**not** required at runtime on deploy.

If you remove `.grok/` entirely:

- Keep or recreate `.grok/app-env.json` **only if** you rely on
  `scripts/with-app-env.mjs` to inject local `VITE_*` flags (e.g.
  `VITE_AUTH_ENABLED`). Without that file, unset `VITE_*` vars simply fall
  through to process env / Vite defaults (auth on unless
  `VITE_AUTH_ENABLED=false`).

Suggested cleanup:

```bash
# Optional: preserve app-env before wiping skills
cp .grok/app-env.json /tmp/story-shelf-app-env.json 2>/dev/null || true
rm -rf .grok/skills .grok/references .grok/status
# Or remove the whole tree and restore app-env if needed:
# rm -rf .grok && mkdir -p .grok && mv /tmp/story-shelf-app-env.json .grok/app-env.json
```

Also consider reviewing `public/__grok/` (PWA / install assets) and
`screenshots/app-builder-*.png` if you want a leaner public repo — not deleted
by these patches.
