-- Member portal support: link users↔members, tighten RLS, invite helpers.
-- Run in Supabase SQL Editor after dashboard-rls-policies.sql.

-- ── Schema ───────────────────────────────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES public.members(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_member_id_uidx
  ON public.users (member_id)
  WHERE member_id IS NOT NULL;

-- ── Helpers ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_member_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT member_id FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_staff_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role::text IN ('admin', 'manager', 'cashier', 'auditor')
       FROM public.users WHERE id = auth.uid()),
    false
  );
$$;

-- SACCO total active savings (for member dashboard). Scoped to caller's institution.
CREATE OR REPLACE FUNCTION public.member_sacco_total_savings()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(SUM(sa.balance), 0)
  FROM public.savings_accounts sa
  JOIN public.members m ON m.id = sa.member_id
  WHERE m.institution_id = public.current_user_institution()
    AND sa.status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.member_sacco_total_savings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_member_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_user() TO authenticated;

-- ── Replace broad staff policies with staff-only + member self-read ──────────
-- Members
DROP POLICY IF EXISTS "Staff manage own institution members" ON members;
DROP POLICY IF EXISTS "Members read own record" ON members;
CREATE POLICY "Staff manage own institution members" ON members
  FOR ALL
  USING (institution_id = current_user_institution() AND is_staff_user())
  WITH CHECK (institution_id = current_user_institution() AND is_staff_user());
CREATE POLICY "Members read own record" ON members
  FOR SELECT
  USING (id = current_member_id());

-- Savings
DROP POLICY IF EXISTS "Staff manage institution savings" ON savings_accounts;
DROP POLICY IF EXISTS "Members read own savings" ON savings_accounts;
CREATE POLICY "Staff manage institution savings" ON savings_accounts
  FOR ALL
  USING (
    is_staff_user()
    AND member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  )
  WITH CHECK (
    is_staff_user()
    AND member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  );
CREATE POLICY "Members read own savings" ON savings_accounts
  FOR SELECT
  USING (member_id = current_member_id());

-- Loans
DROP POLICY IF EXISTS "Staff manage institution loans" ON loans;
DROP POLICY IF EXISTS "Members read own loans" ON loans;
CREATE POLICY "Staff manage institution loans" ON loans
  FOR ALL
  USING (
    is_staff_user()
    AND member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  )
  WITH CHECK (
    is_staff_user()
    AND member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  );
CREATE POLICY "Members read own loans" ON loans
  FOR SELECT
  USING (member_id = current_member_id() OR guarantor_id = current_member_id());

-- Loan repayments
DROP POLICY IF EXISTS "Staff manage institution repayments" ON loan_repayments;
DROP POLICY IF EXISTS "Members read own repayments" ON loan_repayments;
CREATE POLICY "Staff manage institution repayments" ON loan_repayments
  FOR ALL
  USING (
    is_staff_user()
    AND loan_id IN (
      SELECT l.id FROM loans l
      JOIN members m ON m.id = l.member_id
      WHERE m.institution_id = current_user_institution()
    )
  )
  WITH CHECK (
    is_staff_user()
    AND loan_id IN (
      SELECT l.id FROM loans l
      JOIN members m ON m.id = l.member_id
      WHERE m.institution_id = current_user_institution()
    )
  );
CREATE POLICY "Members read own repayments" ON loan_repayments
  FOR SELECT
  USING (
    loan_id IN (SELECT id FROM loans WHERE member_id = current_member_id())
  );

-- Transactions
DROP POLICY IF EXISTS "Staff manage institution transactions" ON transactions;
DROP POLICY IF EXISTS "Members read own transactions" ON transactions;
CREATE POLICY "Staff manage institution transactions" ON transactions
  FOR ALL
  USING (institution_id = current_user_institution() AND is_staff_user())
  WITH CHECK (institution_id = current_user_institution() AND is_staff_user());
CREATE POLICY "Members read own transactions" ON transactions
  FOR SELECT
  USING (member_id = current_member_id());

-- Institutions: members may read their own SACCO (for name / currency on dashboard)
DROP POLICY IF EXISTS "Members read own institution" ON institutions;
CREATE POLICY "Members read own institution" ON institutions
  FOR SELECT
  USING (id = current_user_institution());

-- ── Extend auth signup trigger to store member_id ────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inst   uuid;
  v_member uuid;
  v_full   text;
  v_first  text;
  v_last   text;
  v_role   text;
BEGIN
  v_inst   := NULLIF(NEW.raw_user_meta_data->>'institution_id', '')::uuid;
  v_member := NULLIF(NEW.raw_user_meta_data->>'member_id', '')::uuid;
  IF v_inst IS NULL THEN
    RETURN NEW;
  END IF;

  v_full  := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first := NULLIF(split_part(v_full, ' ', 1), '');
  v_last  := NULLIF(regexp_replace(v_full, '^\S+\s*', ''), '');
  v_role  := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'admin');

  INSERT INTO public.users (
    id, institution_id, member_id, email, password_hash,
    first_name, last_name, phone, role, is_active
  ) VALUES (
    NEW.id,
    v_inst,
    v_member,
    NEW.email,
    'supabase_auth',
    COALESCE(v_first, 'Admin'),
    COALESCE(v_last, ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_role::user_role,
    CASE WHEN v_role = 'member' THEN true ELSE false END
  )
  ON CONFLICT (id) DO UPDATE SET
    member_id = COALESCE(EXCLUDED.member_id, public.users.member_id);

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'handle_new_auth_user failed for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$;
