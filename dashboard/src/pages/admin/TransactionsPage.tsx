import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, formatMoney, fullName, genRef } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { SavingsAccount, Transaction } from '../../types'

const TYPE_FILTERS = ['all', 'deposit', 'withdrawal', 'loan_disbursement', 'loan_repayment'] as const

export default function TransactionsPage() {
  const { profile } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]>('all')
  const [showRecord, setShowRecord] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    account_id: '',
    transaction_type: 'deposit',
    amount: '',
    description: '',
  })

  const load = async () => {
    if (!profile) return
    setError('')
    const [txRes, accRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, members(first_name,last_name,member_number)')
        .eq('institution_id', profile.institution_id)
        .order('transaction_date', { ascending: false })
        .limit(200),
      supabase
        .from('savings_accounts')
        .select('*, members!inner(first_name,last_name,member_number,institution_id)')
        .eq('members.institution_id', profile.institution_id)
        .eq('status', 'active')
        .order('account_number'),
    ])
    if (txRes.error) setError(txRes.error.message)
    setTransactions((txRes.data as Transaction[]) ?? [])
    setAccounts((accRes.data as SavingsAccount[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return transactions.filter((t) => {
      if (typeFilter !== 'all' && t.transaction_type !== typeFilter) return false
      if (!q) return true
      return (
        t.transaction_number.toLowerCase().includes(q) ||
        (t.members ? fullName(t.members).toLowerCase().includes(q) : false) ||
        (t.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [transactions, query, typeFilter])

  const handleRecord = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || saving) return

    const account = accounts.find((a) => a.id === form.account_id)
    if (!account) return
    const amount = Number(form.amount)
    const isWithdrawal = form.transaction_type === 'withdrawal'

    if (isWithdrawal && amount > Number(account.balance)) {
      setError(
        `Insufficient balance: account ${account.account_number} has ${formatMoney(account.balance)}.`
      )
      return
    }

    setSaving(true)
    setError('')

    const newBalance = isWithdrawal
      ? Number(account.balance) - amount
      : Number(account.balance) + amount

    // 1) Record the transaction
    const { error: txErr } = await supabase.from('transactions').insert({
      institution_id: profile.institution_id,
      member_id: account.member_id,
      account_id: account.id,
      transaction_number: genRef('TXN'),
      transaction_type: form.transaction_type,
      amount,
      description: form.description.trim() || null,
      status: 'completed',
      balance_after: newBalance,
      created_by: profile.id,
    })

    if (txErr) {
      setSaving(false)
      setError(txErr.message)
      return
    }

    // 2) Update the account balance
    const { error: balErr } = await supabase
      .from('savings_accounts')
      .update({ balance: newBalance })
      .eq('id', account.id)

    setSaving(false)
    if (balErr) {
      setError(`Transaction recorded but balance update failed: ${balErr.message}`)
    }
    setShowRecord(false)
    setForm({ account_id: '', transaction_type: 'deposit', amount: '', description: '' })
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle="Deposits, withdrawals and loan movements"
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowRecord(true)}>
            <Plus className="h-4 w-4" /> Record transaction
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search reference, member…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                typeFilter === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={transactions.length === 0 ? 'No transactions yet' : 'No transactions match your filters'}
          hint={transactions.length === 0 ? 'Record a deposit to get started.' : undefined}
        />
      ) : (
        <TableShell
          headers={['Reference', 'Member', 'Type', 'Amount', 'Balance after', 'Date', 'Status']}
          footer={`Showing ${filtered.length} of ${transactions.length} transactions (latest 200)`}
        >
          {filtered.map((t) => (
            <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{t.transaction_number}</p>
                <p className="max-w-48 truncate text-xs text-slate-400">{t.description || '—'}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{t.members ? fullName(t.members) : '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`capitalize ${
                    t.transaction_type === 'deposit' || t.transaction_type === 'loan_repayment'
                      ? 'text-brand-700'
                      : 'text-red-600'
                  }`}
                >
                  {t.transaction_type.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-800">{formatMoney(t.amount)}</td>
              <td className="px-4 py-3 text-slate-600">
                {t.account_id ? formatMoney((t as Transaction & { balance_after?: number }).balance_after) : '—'}
              </td>
              <td className="px-4 py-3 text-slate-500">{formatDateTime(t.transaction_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={t.status} />
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal open={showRecord} title="Record transaction" onClose={() => setShowRecord(false)}>
        <form onSubmit={handleRecord} className="space-y-4">
          <div>
            <label className="label">Savings account *</label>
            <select
              className="input"
              required
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            >
              <option value="">Select account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number} — {a.members ? fullName(a.members) : ''} ({formatMoney(a.balance)})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Type *</label>
              <select
                className="input"
                value={form.transaction_type}
                onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}
              >
                <option value="deposit">Deposit</option>
                <option value="withdrawal">Withdrawal</option>
              </select>
            </div>
            <div>
              <label className="label">Amount (UGX) *</label>
              <input
                type="number"
                min="1"
                required
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="e.g. Weekly savings deposit"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setShowRecord(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Recording…' : 'Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
