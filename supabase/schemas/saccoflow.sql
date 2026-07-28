-- SACCOFlow Database Schema
-- Comprehensive SACCO Management System

-- Enums for consistent data values
CREATE TYPE sacco_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE member_status AS ENUM ('active', 'pending', 'suspended', 'inactive');
CREATE TYPE loan_status AS ENUM ('pending', 'approved', 'in_progress', 'completed', 'overdue', 'defaulted');
CREATE TYPE savings_type AS ENUM ('regular', 'fixed_deposit', 'junior', 'retirement');
CREATE TYPE savings_status AS ENUM ('active', 'pending', 'inactive', 'dormant');
CREATE TYPE loan_type AS ENUM ('personal', 'business', 'emergency', 'housing', 'education');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'loan_disbursement', 'loan_repayment', 'interest_earned', 'fee');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'reversed');
CREATE TYPE gender AS ENUM ('male', 'female', 'other');
CREATE TYPE disbursement_method AS ENUM ('mobile_money', 'bank_transfer', 'cash', 'cheque');
CREATE TYPE mobile_money_provider AS ENUM ('mtn', 'airtel', 'other');
CREATE TYPE account_type AS ENUM ('savings', 'loan', 'shares');
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'cashier', 'member', 'auditor');
CREATE TYPE notification_type AS ENUM ('system', 'loan_due', 'payment_received', 'account_update', 'security');

-- Institutions/SACCOs table
CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_number text UNIQUE,
  phone text,
  email text,
  address text,
  currency text DEFAULT 'UGX',
  logo_url text,
  status sacco_status DEFAULT 'active',
  default_language text DEFAULT 'en',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Branches table
CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text UNIQUE,
  address text,
  phone text,
  email text,
  manager_id uuid REFERENCES users(id),
  is_main_branch boolean DEFAULT false,
  status sacco_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Users table (system users, not SACCO members)
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role user_role DEFAULT 'member',
  avatar_url text,
  is_active boolean DEFAULT true,
  last_login_at timestamptz,
  email_verified_at timestamptz,
  two_factor_enabled boolean DEFAULT false,
  permissions jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Members table (SACCO members)
CREATE TABLE members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  member_number text UNIQUE NOT NULL,
  first_name text NOT NULL,
  middle_name text,
  last_name text NOT NULL,
  date_of_birth date NOT NULL,
  gender gender NOT NULL,
  national_id text UNIQUE,
  phone text UNIQUE,
  secondary_phone text,
  email text UNIQUE,
  address text,
  profile_photo_url text,
  status member_status DEFAULT 'pending',
  registration_date date DEFAULT now(),
  branch_join_date date,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Emergency contacts for members
CREATE TABLE emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  name text NOT NULL,
  relationship text NOT NULL,
  phone text NOT NULL,
  address text,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Savings accounts
CREATE TABLE savings_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  account_number text UNIQUE NOT NULL,
  account_type savings_type DEFAULT 'regular',
  account_name text,
  balance numeric DEFAULT 0,
  interest_rate numeric DEFAULT 0,
  minimum_balance numeric DEFAULT 0,
  status savings_status DEFAULT 'active',
  opening_date date DEFAULT now(),
  maturity_date date,
  auto_renew boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Loans table
CREATE TABLE loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  loan_number text UNIQUE NOT NULL,
  loan_type loan_type NOT NULL,
  principal_amount numeric NOT NULL,
  interest_rate numeric NOT NULL,
  term_months integer NOT NULL,
  purpose text,
  application_date date DEFAULT now(),
  approval_date date,
  disbursement_date date,
  maturity_date date,
  amount_disbursed numeric DEFAULT 0,
  amount_repaid numeric DEFAULT 0,
  balance numeric DEFAULT 0,
  status loan_status DEFAULT 'pending',
  interest_amount numeric DEFAULT 0,
  penalty_amount numeric DEFAULT 0,
  monthly_payment numeric,
  guarantor_id uuid REFERENCES members(id),
  disbursement_method disbursement_method,
  disbursement_details jsonb DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Loan repayments
CREATE TABLE loan_repayments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  payment_number integer NOT NULL,
  amount numeric NOT NULL,
  principal_amount numeric DEFAULT 0,
  interest_amount numeric DEFAULT 0,
  penalty_amount numeric DEFAULT 0,
  payment_date date DEFAULT now(),
  payment_method disbursement_method,
  transaction_reference text,
  processed_by uuid REFERENCES users(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- General transactions table
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  account_id uuid REFERENCES savings_accounts(id) ON DELETE SET NULL,
  loan_id uuid REFERENCES loans(id) ON DELETE SET NULL,
  transaction_number text UNIQUE NOT NULL,
  transaction_type transaction_type NOT NULL,
  amount numeric NOT NULL,
  description text,
  transaction_date timestamptz DEFAULT now(),
  status transaction_status DEFAULT 'completed',
  balance_after numeric,
  reference_number text,
  category text,
  tags text[],
  metadata jsonb DEFAULT '{}',
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Shares/Equity table
CREATE TABLE shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  share_number text UNIQUE NOT NULL,
  number_of_shares integer NOT NULL,
  share_value numeric NOT NULL,
  total_value numeric NOT NULL,
  purchase_date date DEFAULT now(),
  status savings_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL,
  is_read boolean DEFAULT false,
  action_url text,
  metadata jsonb DEFAULT '{}',
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Audit log for tracking changes
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Settings table for institution-wide configurations
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text,
  description text,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(institution_id, key)
);

-- Indexes for performance
CREATE INDEX idx_members_institution ON members(institution_id);
CREATE INDEX idx_members_branch ON members(branch_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_member_number ON members(member_number);
CREATE INDEX idx_savings_member ON savings_accounts(member_id);
CREATE INDEX idx_savings_status ON savings_accounts(status);
CREATE INDEX idx_loans_member ON loans(member_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_disbursement ON loans(disbursement_date);
CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_audit_institution ON audit_logs(institution_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);

-- Row Level Security (RLS) policies
-- Enable RLS on all tables
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic examples - customize based on your security requirements)
-- Users can only see their own institution's data
CREATE POLICY "Users can view own institution data" ON institutions
  FOR ALL USING (auth.uid() IN (SELECT id FROM users WHERE institution_id = id));

-- Members can only be viewed/modified by users from same institution
CREATE POLICY "Institution users can manage members" ON members
  FOR ALL USING (institution_id IN (SELECT institution_id FROM users WHERE auth.uid() = id));

-- Similar policies for other tables would go here
-- This is a basic starting point for security

-- Functions for common operations
CREATE OR REPLACE FUNCTION generate_member_number()
RETURNS text AS $$
DECLARE
  new_number text;
  branch_code text;
BEGIN
  SELECT COALESCE(code, 'MAIN') INTO branch_code 
  FROM branches WHERE id = NEW.branch_id;
  
  new_number := branch_code || '-' || 
               LPAD(EXTRACT(YEAR FROM NOW())::text, 4, '0') || 
               LPAD(NEXTVAL('member_seq')::text, 4, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate loan interest
CREATE OR REPLACE FUNCTION calculate_loan_interest(
  principal numeric,
  rate numeric,
  term_months integer
)
RETURNS numeric AS $$
BEGIN
  RETURN (principal * rate / 100) * (term_months / 12.0);
END;
$$ LANGUAGE plpgsql;

-- Function to update savings balance
CREATE OR REPLACE FUNCTION update_savings_balance(
  account_id uuid,
  amount numeric,
  transaction_type transaction_type
)
RETURNS void AS $$
BEGIN
  IF transaction_type IN ('deposit', 'interest_earned') THEN
    UPDATE savings_accounts 
    SET balance = balance + amount, updated_at = NOW()
    WHERE id = account_id;
  ELSIF transaction_type IN ('withdrawal') THEN
    UPDATE savings_accounts 
    SET balance = balance - amount, updated_at = NOW()
    WHERE id = account_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_institutions_updated_at 
  BEFORE UPDATE ON institutions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branches_updated_at 
  BEFORE UPDATE ON branches 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at 
  BEFORE UPDATE ON members 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_savings_accounts_updated_at 
  BEFORE UPDATE ON savings_accounts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at 
  BEFORE UPDATE ON loans 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at 
  BEFORE UPDATE ON transactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Views for common queries
CREATE VIEW member_summary AS
SELECT 
  m.id,
  m.member_number,
  m.first_name,
  m.last_name,
  m.phone,
  m.email,
  m.status,
  COALESCE(SUM(sa.balance), 0) as total_savings,
  COALESCE(l.total_loans, 0) as total_loans,
  COUNT(DISTINCT sa.id) as savings_accounts_count,
  COUNT(DISTINCT l.id) as active_loans_count
FROM members m
LEFT JOIN savings_accounts sa ON m.id = sa.member_id AND sa.status = 'active'
LEFT JOIN (
  SELECT 
    member_id, 
    COUNT(*) as total_loans,
    COALESCE(SUM(balance), 0) as outstanding_balance
  FROM loans 
  WHERE status IN ('in_progress', 'overdue')
  GROUP BY member_id
) l ON m.id = l.member_id
GROUP BY m.id, m.member_number, m.first_name, m.last_name, m.phone, m.email, m.status, l.total_loans;

CREATE VIEW loan_portfolio AS
SELECT 
  l.id,
  l.loan_number,
  l.member_id,
  CONCAT(m.first_name, ' ', m.last_name) as member_name,
  m.member_number,
  l.loan_type,
  l.principal_amount,
  l.amount_disbursed,
  l.amount_repaid,
  l.balance,
  l.interest_rate,
  l.term_months,
  l.status,
  l.disbursement_date,
  l.maturity_date,
  CASE 
    WHEN l.maturity_date < CURRENT_DATE AND l.status != 'completed' THEN 'overdue'
    ELSE l.status
  END as current_status,
  sa.balance as member_savings_balance
FROM loans l
JOIN members m ON l.member_id = m.id
LEFT JOIN savings_accounts sa ON l.member_id = sa.member_id AND sa.status = 'active';

CREATE VIEW daily_transactions AS
SELECT 
  DATE(transaction_date) as transaction_date,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN transaction_type IN ('deposit', 'loan_disbursement') THEN amount ELSE 0 END) as total_credits,
  SUM(CASE WHEN transaction_type IN ('withdrawal', 'loan_repayment') THEN amount ELSE 0 END) as total_debits,
  SUM(amount) as net_amount
FROM transactions 
WHERE status = 'completed'
GROUP BY DATE(transaction_date)
ORDER BY transaction_date DESC;
