import { useEffect, useState } from 'react'
import { ArrowLeftRight, CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, formatMoney, formatNumber } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { Transaction } from '../../types'

export default function MemberTransactionsPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])

  useEffect(() => {
    if (!profile?.member_id) {
      setError('Your login is not linked to a member record. Contact your SACCO.')
      setLoading(false)
      return
    }
    const memberId = profile.member_id
    let cancelled = false

    async function load() {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('member_id', memberId)
        .order('transaction_date', { ascending: false })
        .limit(100)
      if (cancelled) return
      if (error) setError(error.message)
      setTransactions((data as Transaction[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) return <Spinner />

  const completed = transactions.filter((t) => t.status === 'completed').length

  return (
    <div>
      <PageHeader title="My transactions" subtitle="Your recent deposits, withdrawals, and payments" />
      {error && <ErrorNote message={error} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Shown"
          value={formatNumber(transactions.length)}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          tint="purple"
          hint="Latest 100"
        />
        <StatCard
          label="Completed"
          value={formatNumber(completed)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tint="emerald"
        />
      </div>

      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet" />
      ) : (
        <TableShell
          headers={['Reference', 'Type', 'Amount', 'Date', 'Status']}
          footer={`Showing ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
        >
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-800">{t.transaction_number}</td>
              <td className="px-4 py-3 capitalize text-slate-600">
                {t.transaction_type.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-3 font-semibold">{formatMoney(t.amount)}</td>
              <td className="px-4 py-3 text-slate-500">{formatDateTime(t.transaction_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={t.status} />
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  )
}
