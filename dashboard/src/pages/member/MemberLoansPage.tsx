import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClipboardList, HandCoins, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatMoney } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { Loan, SavingsAccount } from '../../types'

export default function MemberLoansPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loans, setLoans] = useState<Loan[]>([])
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [showApply, setShowApply] = useState(false)
  const [repayLoan, setRepayLoan] = useState<Loan | null>(null)
  const [saving, setSaving] = useState(false)

  const [applyForm, setApplyForm] = useState({
    loan_type: 'personal',
    principal_amount: '',
    interest_rate: '12',
    term_months: '12',
    purpose: '',
  })
  const [repayForm, setRepayForm] = useState({ account_id: '', amount: '', notes: '' })

  const load = async () => {
    if (!profile?.member_id) {
      setError('Your login is not linked to a member record. Contact your SACCO.')
      setLoading(false)
      return
    }
    setError('')
    const [loanRes, accRes] = await Promise.all([
      supabase
        .from('loans')
        .select('*')
        .eq('member_id', profile.member_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('savings_accounts')
        .select('*')
        .eq('member_id', profile.member_id)
        .eq('status', 'active')
        .order('account_number'),
    ])
    if (loanRes.error) setError(loanRes.error.message)
    setLoans((loanRes.data as Loan[]) ?? [])
    setAccounts((accRes.data as SavingsAccount[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const preview = useMemo(() => {
    const p = Number(applyForm.principal_amount) || 0
    const r = Number(applyForm.interest_rate) || 0
    const months = Number(applyForm.term_months) || 0
    const interest = ((p * r) / 100) * (months / 12)
    const total = p + interest
    const monthly = months > 0 ? total / months : 0
    return { interest, total, monthly }
  }, [applyForm.principal_amount, applyForm.interest_rate, applyForm.term_months])

  const handleApply = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    const principal = Number(applyForm.principal_amount)
    if (!(principal > 0)) {
      setError('Enter a valid principal amount.')
      return
    }
    setSaving(true)
    setError('')
    const { error } = await supabase.rpc('member_apply_loan', {
      p_loan_type: applyForm.loan_type,
      p_principal: principal,
      p_interest_rate: Number(applyForm.interest_rate),
      p_term_months: Number(applyForm.term_months),
      p_purpose: applyForm.purpose.trim() || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setShowApply(false)
    setApplyForm({
      loan_type: 'personal',
      principal_amount: '',
      interest_rate: '12',
      term_months: '12',
      purpose: '',
    })
    setInfo('Loan application submitted. Your SACCO will review and disburse if approved.')
    load()
  }

  const openRepay = (loan: Loan) => {
    setInfo('')
    setError('')
    setRepayLoan(loan)
    setRepayForm({
      account_id: accounts[0]?.id ?? '',
      amount: String(loan.balance || ''),
      notes: '',
    })
  }

  const handleRepay = async (e: FormEvent) => {
    e.preventDefault()
    if (!repayLoan || saving) return
    const amount = Number(repayForm.amount)
    if (!repayForm.account_id || !(amount > 0)) {
      setError('Choose a savings account and enter a valid amount.')
      return
    }
    setSaving(true)
    setError('')
    const { error } = await supabase.rpc('member_repay_loan', {
      p_loan_id: repayLoan.id,
      p_account_id: repayForm.account_id,
      p_amount: amount,
      p_notes: repayForm.notes.trim() || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setRepayLoan(null)
    setInfo(`Payment of ${formatMoney(amount)} recorded against ${repayLoan.loan_number}.`)
    load()
  }

  if (loading) return <Spinner />

  const openBalance = loans
    .filter((l) => ['in_progress', 'overdue'].includes(l.status))
    .reduce((s, l) => s + Number(l.balance || 0), 0)

  return (
    <div>
      <PageHeader
        title="My loans"
        subtitle="Apply for a loan or pay back an outstanding balance"
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowApply(true)}>
            <Plus className="h-4 w-4" /> Apply for loan
          </button>
        }
      />
      {error && <ErrorNote message={error} />}
      {info && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Outstanding balance"
          value={formatMoney(openBalance)}
          icon={<HandCoins className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label="Total loans"
          value={String(loans.length)}
          icon={<ClipboardList className="h-5 w-5" />}
          tint="brand"
        />
      </div>

      {loans.length === 0 ? (
        <EmptyState title="No loans on file" hint="Apply for a loan to get started." />
      ) : (
        <TableShell
          headers={['Loan', 'Type', 'Principal', 'Balance', 'Disbursed', 'Status', '']}
          footer={`${loans.length} loan${loans.length === 1 ? '' : 's'}`}
        >
          {loans.map((l) => (
            <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-800">{l.loan_number}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{l.loan_type}</td>
              <td className="px-4 py-3">{formatMoney(l.principal_amount)}</td>
              <td className="px-4 py-3 font-semibold">{formatMoney(l.balance)}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(l.disbursement_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={l.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {['in_progress', 'overdue'].includes(l.status) && Number(l.balance) > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-brand-700 hover:underline"
                    onClick={() => openRepay(l)}
                  >
                    Pay back
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal open={showApply} title="Apply for a loan" onClose={() => setShowApply(false)} wide>
        <form onSubmit={handleApply} className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-slate-500 sm:col-span-2">
            Applications start as <strong>pending</strong>. Your SACCO staff must approve and disburse
            before funds are released.
          </p>
          <div>
            <label className="label">Loan type *</label>
            <select
              className="input"
              value={applyForm.loan_type}
              onChange={(e) => setApplyForm({ ...applyForm, loan_type: e.target.value })}
            >
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="emergency">Emergency</option>
              <option value="housing">Housing</option>
              <option value="education">Education</option>
            </select>
          </div>
          <div>
            <label className="label">Principal (UGX) *</label>
            <input
              className="input"
              type="number"
              min="1"
              required
              value={applyForm.principal_amount}
              onChange={(e) => setApplyForm({ ...applyForm, principal_amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Interest rate (% / year) *</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.1"
              required
              value={applyForm.interest_rate}
              onChange={(e) => setApplyForm({ ...applyForm, interest_rate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Term (months) *</label>
            <input
              className="input"
              type="number"
              min="1"
              required
              value={applyForm.term_months}
              onChange={(e) => setApplyForm({ ...applyForm, term_months: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Purpose</label>
            <input
              className="input"
              value={applyForm.purpose}
              onChange={(e) => setApplyForm({ ...applyForm, purpose: e.target.value })}
            />
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 sm:col-span-2">
            Est. interest {formatMoney(preview.interest)} · Total {formatMoney(preview.total)} · Monthly{' '}
            {formatMoney(preview.monthly)}
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setShowApply(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={repayLoan !== null}
        title={repayLoan ? `Pay back ${repayLoan.loan_number}` : 'Pay back loan'}
        onClose={() => setRepayLoan(null)}
      >
        <form onSubmit={handleRepay} className="space-y-4">
          <p className="text-sm text-slate-500">
            Outstanding: <strong>{formatMoney(repayLoan?.balance ?? 0)}</strong>. Payment is taken from
            your savings.
          </p>
          {accounts.length === 0 ? (
            <ErrorNote message="You need an active savings account with enough balance to repay." />
          ) : (
            <>
              <div>
                <label className="label">Pay from account *</label>
                <select
                  className="input"
                  required
                  value={repayForm.account_id}
                  onChange={(e) => setRepayForm({ ...repayForm, account_id: e.target.value })}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number} — {formatMoney(a.balance)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount (UGX) *</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={repayForm.amount}
                  onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Note</label>
                <input
                  className="input"
                  value={repayForm.notes}
                  onChange={(e) => setRepayForm({ ...repayForm, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setRepayLoan(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Processing…' : 'Pay now'}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  )
}
