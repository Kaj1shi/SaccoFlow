-- RLS policies required by the React staff dashboard (dashboard/)
-- Run this in the Supabase SQL Editor AFTER saccoflow.sql and fix-rls-policies.sql.
--
-- Scope: staff (rows in public.users) can read/write data belonging to their
-- own institution. Tables without institution_id are scoped through members.

-- Helper: institution of the currently signed-in staff user
CREATE OR REPLACE FUNCTION current_user_institution()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT institution_id FROM public.users WHERE id = auth.uid();
$$;

-- ── Members ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage own institution members" ON members;
CREATE POLICY "Staff manage own institution members" ON members
  FOR ALL USING (institution_id = current_user_institution())
  WITH CHECK (institution_id = current_user_institution());

-- ── Emergency contacts (scoped through member) ──────────────────────────────
DROP POLICY IF EXISTS "Staff manage member emergency contacts" ON emergency_contacts;
CREATE POLICY "Staff manage member emergency contacts" ON emergency_contacts
  FOR ALL USING (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  )
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  );

-- ── Savings accounts ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage institution savings" ON savings_accounts;
CREATE POLICY "Staff manage institution savings" ON savings_accounts
  FOR ALL USING (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  )
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  );

-- ── Loans ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage institution loans" ON loans;
CREATE POLICY "Staff manage institution loans" ON loans
  FOR ALL USING (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  )
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  );

-- ── Loan repayments ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage institution repayments" ON loan_repayments;
CREATE POLICY "Staff manage institution repayments" ON loan_repayments
  FOR ALL USING (
    loan_id IN (
      SELECT l.id FROM loans l
      JOIN members m ON m.id = l.member_id
      WHERE m.institution_id = current_user_institution()
    )
  )
  WITH CHECK (
    loan_id IN (
      SELECT l.id FROM loans l
      JOIN members m ON m.id = l.member_id
      WHERE m.institution_id = current_user_institution()
    )
  );

-- ── Transactions ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage institution transactions" ON transactions;
CREATE POLICY "Staff manage institution transactions" ON transactions
  FOR ALL USING (institution_id = current_user_institution())
  WITH CHECK (institution_id = current_user_institution());

-- ── Shares ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage institution shares" ON shares;
CREATE POLICY "Staff manage institution shares" ON shares
  FOR ALL USING (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  )
  WITH CHECK (
    member_id IN (SELECT id FROM members WHERE institution_id = current_user_institution())
  );

-- ── Audit logs ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff view institution audit logs" ON audit_logs;
CREATE POLICY "Staff view institution audit logs" ON audit_logs
  FOR SELECT USING (institution_id = current_user_institution());

DROP POLICY IF EXISTS "Staff write institution audit logs" ON audit_logs;
CREATE POLICY "Staff write institution audit logs" ON audit_logs
  FOR INSERT WITH CHECK (institution_id = current_user_institution());

-- ── Settings ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Staff manage institution settings" ON settings;
CREATE POLICY "Staff manage institution settings" ON settings
  FOR ALL USING (institution_id = current_user_institution())
  WITH CHECK (institution_id = current_user_institution());

-- ── Super admin: read all audit logs ─────────────────────────────────────────
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

DROP POLICY IF EXISTS "Super admin views all audit logs" ON audit_logs;
CREATE POLICY "Super admin views all audit logs" ON audit_logs
  FOR SELECT USING (is_super_admin());

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT ALL ON members, emergency_contacts, savings_accounts, loans,
  loan_repayments, transactions, shares, settings TO authenticated;
GRANT SELECT, INSERT ON audit_logs TO authenticated;

-- ── Super admin ──────────────────────────────────────────────────────────────
-- Mark a user as platform super admin (sees /super console in the dashboard):
-- UPDATE users
-- SET permissions = jsonb_set(COALESCE(permissions, '{}'), '{is_super_admin}', 'true')
-- WHERE email = 'you@example.com';
