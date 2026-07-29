import { useEffect, useState } from 'react'
import { ArrowLeftRight, HandCoins, PiggyBank, Wallet } from 'lucide-react'
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
import type { Loan, SavingsAccount, Transaction } from '../../types'

export default function MemberHomePage() {
  const { profile, institution } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mySavings, setMySavings] = useState(0)
  const [saccoSavings, setSaccoSavings] = useState(0)
  const [loanBalance, setLoanBalance] = useState(0)
  const [accounts, setAccounts] = useState<SavingsAccount[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
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
      setError('')
      const [accRes, loanRes, txRes, totalRes] = await Promise.all([
        supabase
          .from('savings_accounts')
          .select('*')
          .eq('member_id', memberId)
          .order('opening_date', { ascending: false }),
        supabase
          .from('loans')
          .select('*')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('*')
          .eq('member_id', memberId)
          .order('transaction_date', { ascending: false })
          .limit(25),
        supabase.rpc('member_sacco_total_savings'),
      ])

      if (cancelled) return

      if (accRes.error || loanRes.error || txRes.error) {
        setError(accRes.error?.message || loanRes.error?.message || txRes.error?.message || 'Failed to load')
      }

      const accs = (accRes.data as SavingsAccount[]) ?? []
      const ls = (loanRes.data as Loan[]) ?? []
      setAccounts(accs)
      setLoans(ls)
      setTransactions((txRes.data as Transaction[]) ?? [])
      setMySavings(accs.filter((a) => a.status === 'active').reduce((s, a) => s + Number(a.balance || 0), 0))
      setLoanBalance(
        ls
          .filter((l) => ['in_progress', 'overdue', 'approved'].includes(l.status))
          .reduce((s, l) => s + Number(l.balance || 0), 0)
      )
      setSaccoSavings(Number(totalRes.data ?? 0))
      if (totalRes.error) {
        // Non-fatal if RPC not installed yet
        console.warn(totalRes.error.message)
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title={`Hello, ${profile?.first_name}`}
        subtitle={`Your member portal at ${institution?.name ?? 'your SACCO'}`}
      />

      {error && <ErrorNote message={error} />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="My savings"
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
        <StatCard
          label="My loan balance"
          value={formatMoney(loanBalance)}
          icon={<HandCoins className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label="Recent transactions"
          value={formatNumber(transactions.length)}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          tint="purple"
          hint="Showing latest 25"
        />
      </div>

      <h2 className="mb-3 font-display text-base font-bold text-slate-900">My savings accounts</h2>
      {accounts.length === 0 ? (
        <EmptyState title="No savings accounts yet" hint="Your SACCO will open an account for you." />
      ) : (
        <div className="mb-8">
          <TableShell headers={['Account', 'Type', 'Balance', 'Status']}>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{a.account_number}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{a.account_type.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 font-semibold">{formatMoney(a.balance)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={a.status} />
                </td>
              </tr>
            ))}
          </TableShell>
        </div>
      )}

      <h2 className="mb-3 font-display text-base font-bold text-slate-900">My loans</h2>
      {loans.length === 0 ? (
        <EmptyState title="No loans on file" />
      ) : (
        <div className="mb-8">
          <TableShell headers={['Loan', 'Type', 'Principal', 'Balance', 'Status']}>
            {loans.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800">{l.loan_number}</td>
                <td className="px-4 py-3 capitalize text-slate-600">{l.loan_type}</td>
                <td className="px-4 py-3">{formatMoney(l.principal_amount)}</td>
                <td className="px-4 py-3 font-semibold">{formatMoney(l.balance)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={l.status} />
                </td>
              </tr>
            ))}
          </TableShell>
        </div>
      )}

      <h2 className="mb-3 font-display text-base font-bold text-slate-900">My transactions</h2>
      {transactions.length === 0 ? (
        <EmptyState title="No transactions yet" />
      ) : (
        <TableShell headers={['Reference', 'Type', 'Amount', 'Date', 'Status']}>
          {transactions.map((t) => (
            <tr key={t.id} className="border-b border-slate-50 last:border-0">
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
