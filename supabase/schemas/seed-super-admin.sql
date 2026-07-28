-- Seed a hardcoded PLATFORM SUPER ADMIN account (bypasses the registration form).
-- Run this once in the Supabase SQL Editor.
--
--   Email:    superadmin@saccoflow.com
--   Password: SaccoFlow#Super2026
--
-- >>> CHANGE THE EMAIL AND PASSWORD BELOW BEFORE RUNNING IN PRODUCTION <<<
--
-- What it creates:
--   1. A confirmed Supabase Auth user (no confirmation email needed)
--   2. A "SaccoFlow Platform" institution (the profile table requires one)
--   3. A public.users profile with role 'admin' and permissions.is_super_admin = true
--
-- Safe to run multiple times — it skips or updates anything that already exists.

DO $$
DECLARE
  v_email    text := 'superadmin@saccoflow.com';
  v_password text := 'SaccoFlow#Super2026';
  v_user_id  uuid;
  v_inst_id  uuid;
BEGIN
  -- ── 1) Auth user (pre-confirmed) ──────────────────────────────────────────
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      now(), now(), now()
    );
  END IF;

  -- ── 2) Platform institution (profile rows require one) ───────────────────
  SELECT id INTO v_inst_id FROM institutions WHERE name = 'SaccoFlow Platform';

  IF v_inst_id IS NULL THEN
    INSERT INTO institutions (name, registration_number, email, status, settings)
    VALUES (
      'SaccoFlow Platform',
      'PLATFORM-0001',
      v_email,
      'active',
      '{"platform_account": true}'::jsonb
    )
    RETURNING id INTO v_inst_id;
  END IF;

  -- ── 3) Staff profile flagged as super admin ───────────────────────────────
  INSERT INTO public.users (
    id, institution_id, email, password_hash,
    first_name, last_name, role, is_active, permissions
  ) VALUES (
    v_user_id, v_inst_id, v_email, 'supabase_auth',
    'Super', 'Admin', 'admin', true,
    '{"is_super_admin": true}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    permissions = jsonb_set(COALESCE(public.users.permissions, '{}'), '{is_super_admin}', 'true'),
    is_active   = true;

  RAISE NOTICE 'Super admin ready: % (user id %)', v_email, v_user_id;
END $$;
