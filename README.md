# SaccoFlow

A digital solution to the SACCO workflow in Uganda.

## Quick start

```bash
# Marketing site + built React dashboard (same origin)
cd dashboard && npm install && npm run build && cd ..
node serve.mjs
# Open http://localhost:8080
```

Configure Supabase credentials in `js/supabase-config.js` and `dashboard/.env` (see `dashboard/.env.example`). SQL schemas live in `supabase/schemas/`.
