-- Automatically create public.users profiles when a Supabase Auth user is created,
-- and repair orphan institutions that have Auth logins but no dashboard profile.
--
-- Run once in the Supabase SQL Editor (safe to re-run).

-- ── 1) Trigger: auth.users → public.users ────────────────────────────────────
-- Registration passes institution_id / full_name / phone / role in user metadata.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst  uuid;
  v_full  text;
  v_first text;
  v_last  text;
  v_role  text;
BEGIN
  v_inst := NULLIF(NEW.raw_user_meta_data->>'institution_id', '')::uuid;
  IF v_inst IS NULL THEN
    -- Seeded platform accounts / users without a SACCO — skip.
    RETURN NEW;
  END IF;

  v_full  := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first := NULLIF(split_part(v_full, ' ', 1), '');
  v_last  := NULLIF(regexp_replace(v_full, '^\S+\s*', ''), '');
  v_role  := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'admin');

  INSERT INTO public.users (
    id, institution_id, email, password_hash,
    first_name, last_name, phone, role, is_active
  ) VALUES (
    NEW.id,
    v_inst,
    NEW.email,
    'supabase_auth',
    COALESCE(v_first, 'Admin'),
    COALESCE(v_last, ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_role::user_role,
    false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Never block Auth signup if profile insert fails; log via RAISE NOTICE.
    RAISE NOTICE 'handle_new_auth_user failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 2) RPC: ensure profile exists when a SACCO is approved ───────────────────
-- Call from the dashboard: supabase.rpc('ensure_institution_admin_profile', { p_institution_id })
CREATE OR REPLACE FUNCTION public.ensure_institution_admin_profile(p_institution_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   text;
  v_phone   text;
  v_full    text;
  v_auth_id uuid;
  v_first   text;
  v_last    text;
  v_created boolean := false;
BEGIN
  -- Only the platform super admin (or a user already on this institution) may call this.
  IF NOT COALESCE(
    (SELECT (permissions->>'is_super_admin')::boolean FROM public.users WHERE id = auth.uid()),
    false
  ) AND NOT EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND institution_id = p_institution_id
  ) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT i.email, i.phone, COALESCE(i.settings->>'contact_person', '')
    INTO v_email, v_phone, v_full
  FROM public.institutions i
  WHERE i.id = p_institution_id;

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'institution_not_found');
  END IF;

  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE lower(email) = lower(v_email)
  ORDER BY created_at
  LIMIT 1;

  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_auth_user', 'email', v_email);
  END IF;

  v_first := COALESCE(NULLIF(split_part(v_full, ' ', 1), ''), 'Admin');
  v_last  := COALESCE(NULLIF(regexp_replace(v_full, '^\S+\s*', ''), ''), '');

  INSERT INTO public.users (
    id, institution_id, email, password_hash,
    first_name, last_name, phone, role, is_active
  ) VALUES (
    v_auth_id, p_institution_id, v_email, 'supabase_auth',
    v_first, v_last, v_phone, 'admin', true
  )
  ON CONFLICT (id) DO UPDATE SET
    institution_id = EXCLUDED.institution_id,
    is_active      = true,
    first_name     = CASE
                       WHEN public.users.first_name IN ('Admin', '') THEN EXCLUDED.first_name
                       ELSE public.users.first_name
                     END,
    last_name      = CASE
                       WHEN public.users.last_name = '' THEN EXCLUDED.last_name
                       ELSE public.users.last_name
                     END;

  GET DIAGNOSTICS v_created = ROW_COUNT;
  -- Activate any other staff rows for this institution as well
  UPDATE public.users SET is_active = true WHERE institution_id = p_institution_id;

  RETURN jsonb_build_object('ok', true, 'user_id', v_auth_id, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_institution_admin_profile(uuid) TO authenticated;

-- ── 3) Backfill existing orphans (institution + auth.users, no public.users) ─
INSERT INTO public.users (
  id, institution_id, email, password_hash,
  first_name, last_name, phone, role, is_active
)
SELECT
  au.id,
  i.id,
  au.email,
  'supabase_auth',
  COALESCE(NULLIF(split_part(COALESCE(i.settings->>'contact_person', ''), ' ', 1), ''), 'Admin'),
  COALESCE(NULLIF(regexp_replace(COALESCE(i.settings->>'contact_person', ''), '^\S+\s*', ''), ''), ''),
  i.phone,
  'admin',
  (i.status = 'active')
FROM auth.users au
JOIN public.institutions i ON lower(i.email) = lower(au.email)
LEFT JOIN public.users u ON u.id = au.id
WHERE u.id IS NULL
  AND i.name <> 'SaccoFlow Platform';

-- Show current staff profiles
SELECT u.email, u.first_name, u.last_name, u.is_active, i.name AS sacco
FROM public.users u
LEFT JOIN public.institutions i ON i.id = u.institution_id
ORDER BY u.created_at;
