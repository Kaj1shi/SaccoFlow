-- Member self-service money operations (SECURITY DEFINER RPCs).
-- Run in Supabase SQL Editor after member-portal.sql.
-- Members stay SELECT-only via RLS; these functions enforce ownership and balances.

CREATE OR REPLACE FUNCTION public.member_gen_ref(p_prefix text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_prefix || '-' || to_char(now(), 'YYYY') || '-' ||
    lpad((floor(random() * 1000000))::int::text, 6, '0');
END;
$$;

-- Deposit or withdraw against the caller's own active savings account.
CREATE OR REPLACE FUNCTION public.member_move_savings(
  p_account_id uuid,
  p_amount numeric,
  p_type text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid := public.current_member_id();
  v_inst   uuid := public.current_user_institution();
  v_acc    public.savings_accounts%ROWTYPE;
  v_new    numeric;
  v_tx_id  uuid;
  v_tx_no  text;
  v_type   public.transaction_type;
BEGIN
  IF v_member IS NULL OR v_inst IS NULL THEN
    RAISE EXCEPTION 'Not linked as a member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;
  IF p_type NOT IN ('deposit', 'withdrawal') THEN
    RAISE EXCEPTION 'Type must be deposit or withdrawal';
  END IF;
  v_type := p_type::public.transaction_type;

  SELECT * INTO v_acc
  FROM public.savings_accounts
  WHERE id = p_account_id
  FOR UPDATE;

  IF NOT FOUND OR v_acc.member_id <> v_member THEN
    RAISE EXCEPTION 'Savings account not found';
  END IF;
  IF v_acc.status <> 'active' THEN
    RAISE EXCEPTION 'Account is not active';
  END IF;

  IF v_type = 'deposit' THEN
    v_new := COALESCE(v_acc.balance, 0) + p_amount;
  ELSE
    v_new := COALESCE(v_acc.balance, 0) - p_amount;
    IF v_new < COALESCE(v_acc.minimum_balance, 0) THEN
      RAISE EXCEPTION 'Insufficient balance (minimum % required)', COALESCE(v_acc.minimum_balance, 0);
    END IF;
  END IF;

  LOOP
    v_tx_no := public.member_gen_ref('TXN');
    BEGIN
      INSERT INTO public.transactions (
        institution_id, member_id, account_id, transaction_number,
        transaction_type, amount, description, status, balance_after, created_by
      ) VALUES (
        v_inst, v_member, v_acc.id, v_tx_no,
        v_type, p_amount, NULLIF(trim(COALESCE(p_description, '')), ''),
        'completed', v_new, auth.uid()
      )
      RETURNING id INTO v_tx_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      -- retry on transaction_number clash
      NULL;
    END;
  END LOOP;

  UPDATE public.savings_accounts
  SET balance = v_new, updated_at = now()
  WHERE id = v_acc.id;

  RETURN v_tx_id;
END;
$$;

-- Member applies for a loan (pending — staff must approve & disburse).
CREATE OR REPLACE FUNCTION public.member_apply_loan(
  p_loan_type text,
  p_principal numeric,
  p_interest_rate numeric,
  p_term_months integer,
  p_purpose text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid := public.current_member_id();
  v_loan_id uuid;
  v_loan_no text;
  v_interest numeric;
  v_monthly numeric;
  v_type public.loan_type;
BEGIN
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Not linked as a member';
  END IF;
  IF p_principal IS NULL OR p_principal <= 0 THEN
    RAISE EXCEPTION 'Principal must be greater than zero';
  END IF;
  IF p_interest_rate IS NULL OR p_interest_rate < 0 THEN
    RAISE EXCEPTION 'Invalid interest rate';
  END IF;
  IF p_term_months IS NULL OR p_term_months < 1 THEN
    RAISE EXCEPTION 'Term must be at least 1 month';
  END IF;

  BEGIN
    v_type := p_loan_type::public.loan_type;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Invalid loan type';
  END;

  -- Flat interest (same as staff UI): P * r% * (months/12)
  v_interest := (p_principal * p_interest_rate / 100.0) * (p_term_months / 12.0);
  v_monthly := (p_principal + v_interest) / p_term_months;

  LOOP
    v_loan_no := public.member_gen_ref('LN');
    BEGIN
      INSERT INTO public.loans (
        member_id, loan_number, loan_type, principal_amount, interest_rate,
        term_months, purpose, interest_amount, monthly_payment, balance,
        status, created_by
      ) VALUES (
        v_member, v_loan_no, v_type, p_principal, p_interest_rate,
        p_term_months, NULLIF(trim(COALESCE(p_purpose, '')), ''),
        v_interest, v_monthly, 0, 'pending', auth.uid()
      )
      RETURNING id INTO v_loan_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  RETURN v_loan_id;
END;
$$;

-- Repay an outstanding loan from the member's own savings account.
CREATE OR REPLACE FUNCTION public.member_repay_loan(
  p_loan_id uuid,
  p_account_id uuid,
  p_amount numeric,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member uuid := public.current_member_id();
  v_inst   uuid := public.current_user_institution();
  v_loan   public.loans%ROWTYPE;
  v_acc    public.savings_accounts%ROWTYPE;
  v_pay    numeric;
  v_new_loan numeric;
  v_new_sav  numeric;
  v_tx_id  uuid;
  v_tx_no  text;
  v_pay_no integer;
BEGIN
  IF v_member IS NULL OR v_inst IS NULL THEN
    RAISE EXCEPTION 'Not linked as a member';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id FOR UPDATE;
  IF NOT FOUND OR v_loan.member_id <> v_member THEN
    RAISE EXCEPTION 'Loan not found';
  END IF;
  IF v_loan.status NOT IN ('in_progress', 'overdue') THEN
    RAISE EXCEPTION 'Only disbursed loans can be repaid (status: %)', v_loan.status;
  END IF;
  IF COALESCE(v_loan.balance, 0) <= 0 THEN
    RAISE EXCEPTION 'Loan has no outstanding balance';
  END IF;

  SELECT * INTO v_acc
  FROM public.savings_accounts
  WHERE id = p_account_id
  FOR UPDATE;
  IF NOT FOUND OR v_acc.member_id <> v_member THEN
    RAISE EXCEPTION 'Savings account not found';
  END IF;
  IF v_acc.status <> 'active' THEN
    RAISE EXCEPTION 'Savings account is not active';
  END IF;

  v_pay := LEAST(p_amount, v_loan.balance);
  v_new_sav := COALESCE(v_acc.balance, 0) - v_pay;
  IF v_new_sav < COALESCE(v_acc.minimum_balance, 0) THEN
    RAISE EXCEPTION 'Insufficient savings balance for this repayment';
  END IF;

  v_new_loan := v_loan.balance - v_pay;

  SELECT COALESCE(MAX(payment_number), 0) + 1 INTO v_pay_no
  FROM public.loan_repayments
  WHERE loan_id = v_loan.id;

  LOOP
    v_tx_no := public.member_gen_ref('TXN');
    BEGIN
      INSERT INTO public.transactions (
        institution_id, member_id, account_id, loan_id, transaction_number,
        transaction_type, amount, description, status, balance_after, created_by
      ) VALUES (
        v_inst, v_member, v_acc.id, v_loan.id, v_tx_no,
        'loan_repayment', v_pay,
        COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Loan repayment for ' || v_loan.loan_number),
        'completed', v_new_sav, auth.uid()
      )
      RETURNING id INTO v_tx_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;

  INSERT INTO public.loan_repayments (
    loan_id, payment_number, amount, principal_amount, payment_date,
    transaction_reference, processed_by, notes
  ) VALUES (
    v_loan.id, v_pay_no, v_pay, v_pay, CURRENT_DATE,
    v_tx_no, auth.uid(), NULLIF(trim(COALESCE(p_notes, '')), '')
  );

  UPDATE public.savings_accounts
  SET balance = v_new_sav, updated_at = now()
  WHERE id = v_acc.id;

  UPDATE public.loans
  SET
    balance = v_new_loan,
    amount_repaid = COALESCE(amount_repaid, 0) + v_pay,
    status = CASE WHEN v_new_loan <= 0 THEN 'completed'::public.loan_status ELSE status END,
    updated_at = now()
  WHERE id = v_loan.id;

  RETURN v_tx_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.member_gen_ref(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_move_savings(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_apply_loan(text, numeric, numeric, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_repay_loan(uuid, uuid, numeric, text) TO authenticated;
