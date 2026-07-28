# SaccoFlow

A digital solution to the SACCO workflow in Uganda.

## Quick start (local)

```bash
cd dashboard && npm install && npm run build && cd ..
node serve.mjs
# Open http://localhost:8080
```

Configure Supabase in `js/supabase-config.js` and `dashboard/.env` (see `dashboard/.env.example`). SQL schemas live in `supabase/schemas/`.

## GitHub Pages

The live site is at `https://Kaj1shi.github.io/SaccoFlow/`.

Rebuild the published site anytime with:

```bash
node scripts/prepare-pages.mjs
```

Then commit/push `docs/`, and in the repo set **Settings → Pages → Branch: main → Folder: /docs**.

Also add these in Supabase → Authentication → URL Configuration:

- Site URL: `https://Kaj1shi.github.io/SaccoFlow/`
- Redirect URLs: `https://Kaj1shi.github.io/SaccoFlow/dashboard/reset-password`
