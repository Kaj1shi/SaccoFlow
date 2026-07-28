export type UserRole = 'admin' | 'manager' | 'cashier' | 'member' | 'auditor'

export interface Profile {
  id: string
  institution_id: string
  branch_id: string | null
  email: string
  first_name: string
  last_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  permissions: Record<string, unknown> | null
}

export interface Institution {
  id: string
  name: string
  registration_number: string | null
  phone: string | null
  email: string | null
  address: string | null
  currency: string
  status: 'active' | 'inactive' | 'suspended'
  settings: Record<string, unknown> | null
  created_at: string
}

export interface Member {
  id: string
  institution_id: string
  member_number: string
  first_name: string
  middle_name: string | null
  last_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other'
  national_id: string | null
  phone: string | null
  email: string | null
  address: string | null
  status: 'active' | 'pending' | 'suspended' | 'inactive'
  registration_date: string
  created_at: string
}

export interface SavingsAccount {
  id: string
  member_id: string
  account_number: string
  account_type: 'regular' | 'fixed_deposit' | 'junior' | 'retirement'
  account_name: string | null
  balance: number
  interest_rate: number
  status: 'active' | 'pending' | 'inactive' | 'dormant'
  opening_date: string
  members?: Pick<Member, 'first_name' | 'last_name' | 'member_number'> | null
}

export interface Loan {
  id: string
  member_id: string
  loan_number: string
  loan_type: 'personal' | 'business' | 'emergency' | 'housing' | 'education'
  principal_amount: number
  interest_rate: number
  term_months: number
  purpose: string | null
  application_date: string
  approval_date: string | null
  disbursement_date: string | null
  amount_repaid: number
  balance: number
  status: 'pending' | 'approved' | 'in_progress' | 'completed' | 'overdue' | 'defaulted'
  monthly_payment: number | null
  members?: Pick<Member, 'first_name' | 'last_name' | 'member_number'> | null
}

export interface Transaction {
  id: string
  institution_id: string
  member_id: string | null
  account_id: string | null
  transaction_number: string
  transaction_type:
    | 'deposit'
    | 'withdrawal'
    | 'loan_disbursement'
    | 'loan_repayment'
    | 'interest_earned'
    | 'fee'
  amount: number
  description: string | null
  transaction_date: string
  status: 'pending' | 'completed' | 'failed' | 'reversed'
  members?: Pick<Member, 'first_name' | 'last_name' | 'member_number'> | null
}

export interface AuditLog {
  id: string
  institution_id: string | null
  user_id: string | null
  table_name: string
  action: string
  created_at: string
}
