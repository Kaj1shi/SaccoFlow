-- Backfill missing dashboard profiles AND fix admin names.
-- Safe to run multiple times.
--
-- Background:
--   1. Accounts registered while the profile insert was broken have a
--      Supabase Auth login and an institution, but no row in public.users.
--   2. institutions.settings was stored double-encoded (a JSON string instead
--      of an object), which hid contact_person — so backfilled admins got
--      placeholder names like "Admin".

-- ── Step 1: repair double-encoded settings ───────────────────────────────────
UPDATE public.institutions
SET settings = (settings #>> '{}')::jsonb
WHERE jsonb_typeof(settings) = 'string';

-- ── Step 2: create missing profiles ──────────────────────────────────────────
INSERT INTO public.users (
  id, institution_id, email, password_hash,
  first_name, last_name, phone, role, is_active
)
SELECT
  au.id,
  i.id,
  au.email,
  'supabase_auth',
  COALESCE(NULLIF(split_part(i.settings->>'contact_person', ' ', 1), ''), 'Admin'),
  COALESCE(NULLIF(regexp_replace(i.settings->>'contact_person', '^\S+\s*', ''), ''), ''),
  i.phone,
  'admin',
  (i.status = 'active')
FROM auth.users au
JOIN public.institutions i ON lower(i.email) = lower(au.email)
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL;

-- ── Step 3: fill in placeholder names from the registration contact person ──
UPDATE public.users u
SET
  first_name = COALESCE(NULLIF(split_part(i.settings->>'contact_person', ' ', 1), ''), u.first_name),
  last_name  = COALESCE(NULLIF(regexp_replace(i.settings->>'contact_person', '^\S+\s*', ''), ''), u.last_name)
FROM public.institutions i
WHERE i.id = u.institution_id
  AND COALESCE(i.settings->>'contact_person', '') <> ''
  AND (u.first_name = 'Admin' AND u.last_name = '');

-- Show the result
SELECT email, first_name, last_name, role, is_active FROM public.users ORDER BY created_at;
