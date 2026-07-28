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
import type { Member, SavingsAccount } from '../../types'

export default function SavingsPage() {
  const { profile } = useAuth()
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [showOpen, setShowOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    member_id: '',
    account_type: 'regular',
    account_name: '',
    interest_rate: '0',
    minimum_balance: '0',
  })

  const load = async () => {
    if (!profile) return
    setError('')
    const [accRes, memRes] = await Promise.all([
      supabase
        .from('savings_accounts')
        .select('*, members!inner(first_name,last_name,member_number,institution_id)')
        .eq('members.institution_id', profile.institution_id)
        .order('created_at', { ascending: false }),
      supabase
        .from('members')
        .select('*')
        .eq('institution_id', profile.institution_id)
        .eq('status', 'active')
        .order('first_name'),
    ])
    if (accRes.error) setError(accRes.error.message)
    setAccounts((accRes.data as SavingsAccount[]) ?? [])
    setMembers((memRes.data as Member[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        a.account_number.toLowerCase().includes(q) ||
        (a.members ? fullName(a.members).toLowerCase().includes(q) : false) ||
        (a.account_name ?? '').toLowerCase().includes(q)
    )
  }, [accounts, query])

  const totalBalance = accounts
    .filter((a) => a.status === 'active')
    .reduce((s, a) => s + Number(a.balance || 0), 0)

  const handleOpen = async (e: FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')

    const { error } = await supabase.from('savings_accounts').insert({
      member_id: form.member_id,
      account_number: genRef('ACC'),
      account_type: form.account_type,
      account_name: form.account_name.trim() || null,
      interest_rate: Number(form.interest_rate) || 0,
      minimum_balance: Number(form.minimum_balance) || 0,
      balance: 0,
      status: 'active',
    })

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setShowOpen(false)
    setForm({ member_id: '', account_type: 'regular', account_name: '', interest_rate: '0', minimum_balance: '0' })
    load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Savings"
        subtitle={`${accounts.length} account${accounts.length === 1 ? '' : 's'} · ${formatMoney(totalBalance)} total active balance`}
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowOpen(true)}>
            <Plus className="h-4 w-4" /> Open account
          </button>
        }
      />

      {error && <ErrorNote message={error} />}

      <div className="relative mb-4 min-w-56 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search account or member…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={accounts.length === 0 ? 'No savings accounts yet' : 'No accounts match your search'}
          hint={accounts.length === 0 ? 'Open the first account for an active member.' : undefined}
        />
      ) : (
        <TableShell
          headers={['Account', 'Member', 'Type', 'Balance', 'Interest', 'Opened', 'Status']}
          footer={`Showing ${filtered.length} of ${accounts.length} accounts`}
        >
          {filtered.map((a) => (
            <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{a.account_number}</p>
                <p className="text-xs text-slate-400">{a.account_name || '—'}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                {a.members ? fullName(a.members) : '—'}
                <p className="text-xs text-slate-400">{a.members?.member_number}</p>
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">
                {a.account_type.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-800">{formatMoney(a.balance)}</td>
              <td className="px-4 py-3 text-slate-600">{Number(a.interest_rate)}%</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(a.opening_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal open={showOpen} title="Open savings account" onClose={() => setShowOpen(false)}>
        <form onSubmit={handleOpen} className="space-y-4">
          <div>
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
            <label className="label">Account type *</label>
            <select
              className="input"
              value={form.account_type}
              onChange={(e) => setForm({ ...form, account_type: e.target.value })}
            >
              <option value="regular">Regular savings</option>
              <option value="fixed_deposit">Fixed deposit</option>
              <option value="junior">Junior (minor)</option>
              <option value="retirement">Retirement</option>
            </select>
          </div>
          <div>
            <label className="label">Account name</label>
            <input
              className="input"
              placeholder="e.g. School fees fund"
              value={form.account_name}
              onChange={(e) => setForm({ ...form, account_name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Interest rate (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="input"
                value={form.interest_rate}
                onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Minimum balance (UGX)</label>
              <input
                type="number"
                min="0"
                className="input"
                value={form.minimum_balance}
                onChange={(e) => setForm({ ...form, minimum_balance: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setShowOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Opening…' : 'Open account'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
