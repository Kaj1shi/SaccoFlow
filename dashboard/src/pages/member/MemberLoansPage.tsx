import { useEffect, useState } from 'react'
import { ClipboardList, HandCoins } from 'lucide-react'
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
import type { Loan } from '../../types'

export default function MemberLoansPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loans, setLoans] = useState<Loan[]>([])

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
        .from('loans')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      setLoans((data as Loan[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) return <Spinner />

  const openBalance = loans
    .filter((l) => ['in_progress', 'overdue', 'approved'].includes(l.status))
    .reduce((s, l) => s + Number(l.balance || 0), 0)

  return (
    <div>
      <PageHeader title="My loans" subtitle="Loan applications and outstanding balances" />
      {error && <ErrorNote message={error} />}

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
        <EmptyState title="No loans on file" hint="When you take a loan, it will appear here." />
      ) : (
        <TableShell
          headers={['Loan', 'Type', 'Principal', 'Balance', 'Disbursed', 'Status']}
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
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  )
}
