-- Fix RLS Policies for SACCO Registration System
-- These policies allow anonymous users to register institutions and
-- authenticated users to manage their own institution's data.
--
-- Safe to run multiple times (drops and recreates each policy).

-- ── Helper ───────────────────────────────────────────────────────────────────
-- Returns the institution of the signed-in staff user.
-- SECURITY DEFINER lets policies look this up WITHOUT re-triggering RLS on
-- the users table (which would cause "infinite recursion detected" errors).
CREATE OR REPLACE FUNCTION current_user_institution()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT institution_id FROM public.users WHERE id = auth.uid();
$$;

-- Drop ALL existing policies on the tables this file manages, whatever their
-- names — stale policies from earlier experiments (especially recursive ones
-- on "users") break every query with "infinite recursion detected".
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('institutions', 'users', 'branches', 'notifications')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Drop old policies on other tables that cause permission issues
DROP POLICY IF EXISTS "Institution users can manage members" ON members;

-- ── Institutions ─────────────────────────────────────────────────────────────
-- Allow anonymous users to insert institutions (for registration)
DROP POLICY IF EXISTS "Enable public institution registration" ON institutions;
CREATE POLICY "Enable public institution registration" ON institutions
  FOR INSERT WITH CHECK (true);

-- Allow users to see all institutions (for super admin dashboard)
DROP POLICY IF EXISTS "Allow viewing all institutions" ON institutions;
CREATE POLICY "Allow viewing all institutions" ON institutions
  FOR SELECT USING (true);

-- Allow users to update institutions they belong to
DROP POLICY IF EXISTS "Users can update own institution" ON institutions;
CREATE POLICY "Users can update own institution" ON institutions
  FOR UPDATE USING (id = current_user_institution());

-- Allow users to delete institutions they belong to
DROP POLICY IF EXISTS "Users can delete own institution" ON institutions;
CREATE POLICY "Users can delete own institution" ON institutions
  FOR DELETE USING (id = current_user_institution());

-- ── Users ────────────────────────────────────────────────────────────────────
-- Allow anonymous users to insert users (during registration)
DROP POLICY IF EXISTS "Enable user registration" ON users;
CREATE POLICY "Enable user registration" ON users
  FOR INSERT WITH CHECK (true);

-- Allow users to see their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Allow users to see users from their institution
DROP POLICY IF EXISTS "Institution users can view institution users" ON users;
CREATE POLICY "Institution users can view institution users" ON users
  FOR SELECT USING (institution_id = current_user_institution());

-- Allow users to update users from their institution
DROP POLICY IF EXISTS "Institution users can manage institution users" ON users;
CREATE POLICY "Institution users can manage institution users" ON users
  FOR UPDATE USING (institution_id = current_user_institution());

-- Allow users to delete users from their institution
DROP POLICY IF EXISTS "Institution users can delete institution users" ON users;
CREATE POLICY "Institution users can delete institution users" ON users
  FOR DELETE USING (institution_id = current_user_institution());

-- ── Branches ─────────────────────────────────────────────────────────────────
-- Allow viewing all branches (for super admin)
DROP POLICY IF EXISTS "Allow viewing all branches" ON branches;
CREATE POLICY "Allow viewing all branches" ON branches
  FOR SELECT USING (true);

-- Allow managing branches for your institution
DROP POLICY IF EXISTS "Institution users can manage branches" ON branches;
CREATE POLICY "Institution users can manage branches" ON branches
  FOR ALL USING (institution_id = current_user_institution())
  WITH CHECK (institution_id = current_user_institution());

-- ── Notifications ────────────────────────────────────────────────────────────
-- Allow viewing all notifications (for super admin)
DROP POLICY IF EXISTS "Allow viewing all notifications" ON notifications;
CREATE POLICY "Allow viewing all notifications" ON notifications
  FOR SELECT USING (true);

-- Notifications have no institution_id column — they belong to a user directly
DROP POLICY IF EXISTS "Institution users can manage notifications" ON notifications;
DROP POLICY IF EXISTS "Users manage own notifications" ON notifications;
CREATE POLICY "Users manage own notifications" ON notifications
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Platform super admin ─────────────────────────────────────────────────────
-- The super admin (users.permissions.is_super_admin = true) manages ALL
-- SACCOs, not just their own institution. SECURITY DEFINER avoids RLS
-- recursion on the users table.
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE((permissions->>'is_super_admin')::boolean, false)
  FROM public.users
  WHERE id = auth.uid();
$$;

CREATE POLICY "Super admin manages all institutions" ON institutions
  FOR UPDATE USING (is_super_admin());

CREATE POLICY "Super admin deletes institutions" ON institutions
  FOR DELETE USING (is_super_admin());

CREATE POLICY "Super admin views all users" ON users
  FOR SELECT USING (is_super_admin());

CREATE POLICY "Super admin manages all users" ON users
  FOR UPDATE USING (is_super_admin());

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT ALL ON institutions TO anon;
GRANT ALL ON institutions TO authenticated;
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;
GRANT ALL ON branches TO authenticated;
GRANT ALL ON notifications TO authenticated;
