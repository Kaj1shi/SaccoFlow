import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatMoney, fullName, genRef } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { Loan, Member } from '../../types'

const STATUS_FILTERS = ['all', 'pending', 'approved', 'in_progress', 'completed', 'overdue'] as const

export default function LoansPage() {
  const { profile } = useAuth()
  const [loans, setLoans] = useState<Loan[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyLoanId, setBusyLoanId] = useState<string | null>(null)

  const [form, setForm] = useState({
    member_id: '',
    loan_type: 'personal',
    principal_amount: '',
    interest_rate: '12',
    term_months: '12',
    purpose: '',
  })

  const load = async () => {
    if (!profile) return
    setError('')
    const [loanRes, memRes] = await Promise.all([
      supabase
        .from('loans')
        // Disambiguate: loans has both member_id and guarantor_id → members
        .select('*, members!member_id!inner(first_name,last_name,member_number,institution_id)')
        .eq('members.institution_id', profile.institution_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('members')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('status', 'active')
        .order('first_name'),
    ])
    if (loanRes.error) setError(loanRes.error.message)
    setLoans((loanRes.data as Loan[]) ?? [])
    setMembers((memRes.data as Member[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return loans.filter((l) => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false
      if (!q) return true
      return (
        l.loan_number.toLowerCase().includes(q) ||
        (l.members ? fullName(l.members).toLowerCase().includes(q) : false)
      )
    })
  }, [loans, query, statusFilter])

  // Simple flat-rate schedule: interest = P * r% * (months/12)
  const preview = useMemo(() => {
    const p = Number(form.principal_amount) || 0
    const r = Number(form.interest_rate) || 0
    const months = Number(form.term_months) || 0
    const interest = (p * r) / 100 * (months / 12)
    const total = p + interest
    const monthly = months > 0 ? total / months : 0
    return { interest, total, monthly }
  }, [form.principal_amount, form.interest_rate, form.term_months])

  const handleNew = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || saving) return
    setSaving(true)
    setError('')

    const principal = Number(form.principal_amount)
    const { error } = await supabase.from('loans').insert({
      member_id: form.member_id,
      loan_number: genRef('LN'),
      loan_type: form.loan_type,
      principal_amount: principal,
      interest_rate: Number(form.interest_rate),
      term_months: Number(form.term_months),
      purpose: form.purpose.trim() || null,
      interest_amount: preview.interest,
      monthly_payment: preview.monthly,
      balance: 0,
      status: 'pending',
      created_by: profile.id,
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setShowNew(false)
    setForm({ member_id: '', loan_type: 'personal', principal_amount: '', interest_rate: '12', term_months: '12', purpose: '' })
    load()
  }

  const approveLoan = async (loan: Loan) => {
    if (!profile) return
    setBusyLoanId(loan.id)
    const { error } = await supabase
      .from('loans')
      .update({
        status: 'approved',
        approval_date: new Date().toISOString().slice(0, 10),
        approved_by: profile.id,
      })
      .eq('id', loan.id)
    setBusyLoanId(null)
    if (error) setError(error.message)
    else load()
  }

  const disburseLoan = async (loan: Loan) => {
    if (!profile) return
    if (!window.confirm(`Disburse ${formatMoney(loan.principal_amount)} to ${loan.members ? fullName(loan.members) : 'member'}?`)) {
      return
    }
    setBusyLoanId(loan.id)
    setError('')

    const today = new Date()
    const maturity = new Date(today)
    maturity.setMonth(maturity.getMonth() + loan.term_months)
    const interest = (Number(loan.principal_amount) * Number(loan.interest_rate)) / 100 * (loan.term_months / 12)
    const totalDue = Number(loan.principal_amount) + interest

    const { error: loanErr } = await supabase
      .from('loans')
      .update({
        status: 'in_progress',
        disbursement_date: today.toISOString().slice(0, 10),
        maturity_date: maturity.toISOString().slice(0, 10),
        amount_disbursed: loan.principal_amount,
        balance: totalDue,
      })
      .eq('id', loan.id)

    if (loanErr) {
      setBusyLoanId(null)
      setError(loanErr.message)
      return
    }

    // Record the disbursement transaction
    const { error: txErr } = await supabase.from('transactions').insert({
      institution_id: profile.institution_id,
      member_id: loan.member_id,
      loan_id: loan.id,
      transaction_number: genRef('TXN'),
      transaction_type: 'loan_disbursement',
      amount: loan.principal_amount,
      description: `Disbursement for loan ${loan.loan_number}`,
      status: 'completed',
      created_by: profile.id,
    })

    setBusyLoanId(null)
    if (txErr) setError(`Loan updated but transaction log failed: ${txErr.message}`)
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Loans"
        subtitle={`${loans.length} loan${loans.length === 1 ? '' : 's'} in portfolio`}
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> New loan
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search loan number or member…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={loans.length === 0 ? 'No loans yet' : 'No loans match your filters'}
          hint={loans.length === 0 ? 'Create a loan application to get started.' : undefined}
        />
      ) : (
        <TableShell
          headers={['Loan', 'Member', 'Type', 'Principal', 'Balance', 'Term', 'Status', '']}
          footer={`Showing ${filtered.length} of ${loans.length} loans`}
        >
          {filtered.map((l) => (
            <tr key={l.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{l.loan_number}</p>
                <p className="text-xs text-slate-400">Applied {formatDate(l.application_date)}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {l.members ? fullName(l.members) : '—'}
                <p className="text-xs text-slate-400">{l.members?.member_number}</p>
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">{l.loan_type}</td>
              <td className="px-4 py-3 font-semibold text-slate-800">
                {formatMoney(l.principal_amount)}
              </td>
              <td className="px-4 py-3 text-slate-600">{formatMoney(l.balance)}</td>
              <td className="px-4 py-3 text-slate-600">{l.term_months} mo</td>
              <td className="px-4 py-3">
                <StatusBadge status={l.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {l.status === 'pending' && (
                  <button
                    type="button"
                    disabled={busyLoanId === l.id}
                    onClick={() => approveLoan(l)}
                    className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                {l.status === 'approved' && (
                  <button
                    type="button"
                    disabled={busyLoanId === l.id}
                    onClick={() => disburseLoan(l)}
                    className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                  >
                    Disburse
                  </button>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal open={showNew} title="New loan application" onClose={() => setShowNew(false)} wide>
        <form onSubmit={handleNew} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Member *</label>
            <select
              className="input"
              required
              value={form.member_id}
              onChange={(e) => setForm({ ...form, member_id: e.target.value })}
            >
              <option value="">Select member…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m)} ({m.member_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Loan type *</label>
            <select
              className="input"
              value={form.loan_type}
              onChange={(e) => setForm({ ...form, loan_type: e.target.value })}
            >
              <option value="personal">Personal</option>
              <option value="business">Business</option>
              <option value="emergency">Emergency</option>
              <option value="housing">Housing</option>
              <option value="education">Education</option>
            </select>
          </div>
          <div>
            <label className="label">Principal amount (UGX) *</label>
            <input
              type="number"
              min="1"
              required
              className="input"
              value={form.principal_amount}
              onChange={(e) => setForm({ ...form, principal_amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Interest rate (% p.a.) *</label>
            <input
              type="number"
              step="0.1"
              min="0"
              required
              className="input"
              value={form.interest_rate}
              onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Term (months) *</label>
            <input
              type="number"
              min="1"
              required
              className="input"
              value={form.term_months}
              onChange={(e) => setForm({ ...form, term_months: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Purpose</label>
            <input
              className="input"
              placeholder="e.g. Stock for retail shop"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            />
          </div>

          {Number(form.principal_amount) > 0 && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm sm:col-span-2">
              <p className="mb-1 font-semibold text-slate-700">Repayment preview (flat rate)</p>
              <div className="grid grid-cols-3 gap-2 text-slate-600">
                <span>
                  Interest: <strong>{formatMoney(preview.interest)}</strong>
                </span>
                <span>
                  Total due: <strong>{formatMoney(preview.total)}</strong>
                </span>
                <span>
                  Monthly: <strong>{formatMoney(preview.monthly)}</strong>
                </span>
              </div>
            </div>
          )}

          <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
