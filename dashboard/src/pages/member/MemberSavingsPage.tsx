import { useEffect, useState } from 'react'
import { PiggyBank, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, formatMoney } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
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
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [saccoSavings, setSaccoSavings] = useState(0)

  useEffect(() => {
    if (!profile?.member_id) {
      setError('Your login is not linked to a member record. Contact your SACCO.')
      setLoading(false)
      return
    }
    const memberId = profile.member_id
    let cancelled = false

    async function load() {
      const [accRes, totalRes] = await Promise.all([
        supabase
          .from('savings_accounts')
          .select('*')
          .eq('member_id', memberId)
          .order('opening_date', { ascending: false }),
        supabase.rpc('member_sacco_total_savings'),
      ])
      if (cancelled) return
      if (accRes.error) setError(accRes.error.message)
      setAccounts((accRes.data as SavingsAccount[]) ?? [])
      setSaccoSavings(Number(totalRes.data ?? 0))
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) return <Spinner />

  const mySavings = accounts
    .filter((a) => a.status === 'active')
    .reduce((s, a) => s + Number(a.balance || 0), 0)

  return (
    <div>
      <PageHeader title="My savings" subtitle="Your savings accounts with this SACCO" />
      {error && <ErrorNote message={error} />}

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
        <TableShell headers={['Account', 'Type', 'Balance', 'Opened', 'Status']} footer={`${accounts.length} account${accounts.length === 1 ? '' : 's'}`}>
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
    </div>
  )
}
