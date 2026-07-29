import { useEffect, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, PiggyBank, Wallet } from 'lucide-react'
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
import type { SavingsAccount } from '../../types'

export default function MemberSavingsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [saccoSavings, setSaccoSavings] = useState(0)
  const [modal, setModal] = useState<'deposit' | 'withdraw' | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ account_id: '', amount: '', description: '' })

  const load = async () => {
    if (!profile?.member_id) {
      setError('Your login is not linked to a member record. Contact your SACCO.')
      setLoading(false)
      return
    }
    setError('')
    const [accRes, totalRes] = await Promise.all([
      supabase
        .from('savings_accounts')
        .select('*')
        .eq('member_id', profile.member_id)
        .order('opening_date', { ascending: false }),
      supabase.rpc('member_sacco_total_savings'),
    ])
    if (accRes.error) setError(accRes.error.message)
    setAccounts((accRes.data as SavingsAccount[]) ?? [])
    setSaccoSavings(Number(totalRes.data ?? 0))
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const activeAccounts = accounts.filter((a) => a.status === 'active')

  const openModal = (kind: 'deposit' | 'withdraw') => {
    setInfo('')
    setError('')
    setForm({
      account_id: activeAccounts[0]?.id ?? '',
      amount: '',
      description: '',
    })
    setModal(kind)
  }

  const handleMove = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal || saving) return
    const amount = Number(form.amount)
    if (!form.account_id || !(amount > 0)) {
      setError('Choose an account and enter a valid amount.')
      return
    }
    setSaving(true)
    setError('')
    const { error } = await supabase.rpc('member_move_savings', {
      p_account_id: form.account_id,
      p_amount: amount,
      p_type: modal === 'deposit' ? 'deposit' : 'withdrawal',
      p_description: form.description.trim() || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setModal(null)
    setInfo(
      modal === 'deposit'
        ? `Deposit of ${formatMoney(amount)} completed.`
        : `Withdrawal of ${formatMoney(amount)} completed.`
    )
    load()
  }

  if (loading) return <Spinner />

  const mySavings = activeAccounts.reduce((s, a) => s + Number(a.balance || 0), 0)

  return (
    <div>
      <PageHeader
        title="My savings"
        subtitle="Deposit or withdraw from your accounts"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={activeAccounts.length === 0}
              onClick={() => openModal('withdraw')}
            >
              <ArrowUpFromLine className="h-4 w-4" /> Withdraw
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={activeAccounts.length === 0}
              onClick={() => openModal('deposit')}
            >
              <ArrowDownToLine className="h-4 w-4" /> Deposit
            </button>
          </div>
        }
      />
      {error && <ErrorNote message={error} />}
      {info && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </div>
      )}

      {activeAccounts.length === 0 && accounts.length === 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Deposit and withdraw stay disabled until your SACCO opens a savings account for you (staff:
          Savings → Open account).
        </div>
      )}
      {activeAccounts.length === 0 && accounts.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You have savings accounts, but none are active. Ask your SACCO to activate one before
          depositing or withdrawing.
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="My total savings"
          value={formatMoney(mySavings)}
          icon={<Wallet className="h-5 w-5" />}
          tint="brand"
        />
        <StatCard
          label="SACCO total savings"
          value={formatMoney(saccoSavings)}
          icon={<PiggyBank className="h-5 w-5" />}
          tint="emerald"
          hint="All members combined"
        />
      </div>

      {accounts.length === 0 ? (
        <EmptyState title="No savings accounts yet" hint="Your SACCO will open an account for you." />
      ) : (
        <TableShell
          headers={['Account', 'Type', 'Balance', 'Opened', 'Status']}
          footer={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
        >
          {accounts.map((a) => (
            <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-800">{a.account_number}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{a.account_type.replace(/_/g, ' ')}</td>
              <td className="px-4 py-3 font-semibold">{formatMoney(a.balance)}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(a.opening_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal
        open={modal !== null}
        title={modal === 'deposit' ? 'Deposit funds' : 'Withdraw funds'}
        onClose={() => setModal(null)}
      >
        <form onSubmit={handleMove} className="space-y-4">
          <div>
            <label className="label">Account *</label>
            <select
              className="input"
              required
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
            >
              {activeAccounts.map((a) => (
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
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Note</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Processing…' : modal === 'deposit' ? 'Deposit' : 'Withdraw'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
