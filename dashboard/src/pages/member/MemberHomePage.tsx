import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, HandCoins, PiggyBank, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatNumber } from '../../lib/format'
import { ErrorNote, PageHeader, Spinner, StatCard } from '../../components/ui'
import type { Loan, SavingsAccount } from '../../types'

export default function MemberHomePage() {
  const { profile, institution } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mySavings, setMySavings] = useState(0)
  const [saccoSavings, setSaccoSavings] = useState(0)
  const [loanBalance, setLoanBalance] = useState(0)
  const [txCount, setTxCount] = useState(0)

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
        supabase.from('savings_accounts').select('balance, status').eq('member_id', memberId),
        supabase.from('loans').select('balance, status').eq('member_id', memberId),
        supabase
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId),
        supabase.rpc('member_sacco_total_savings'),
      ])

      if (cancelled) return

      if (accRes.error || loanRes.error || txRes.error) {
        setError(accRes.error?.message || loanRes.error?.message || txRes.error?.message || 'Failed to load')
      }

      const accs = (accRes.data as Pick<SavingsAccount, 'balance' | 'status'>[]) ?? []
      const ls = (loanRes.data as Pick<Loan, 'balance' | 'status'>[]) ?? []
      setMySavings(accs.filter((a) => a.status === 'active').reduce((s, a) => s + Number(a.balance || 0), 0))
      setLoanBalance(
        ls
          .filter((l) => ['in_progress', 'overdue', 'approved'].includes(l.status))
          .reduce((s, l) => s + Number(l.balance || 0), 0)
      )
      setTxCount(txRes.count ?? 0)
      setSaccoSavings(Number(totalRes.data ?? 0))
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
        subtitle={`Your account at ${institution?.name ?? 'your SACCO'}`}
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
          label="Transactions"
          value={formatNumber(txCount)}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          tint="purple"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/member/savings"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
        >
          <PiggyBank className="mb-3 h-6 w-6 text-brand-600" />
          <p className="font-display text-base font-bold text-slate-900">Savings</p>
          <p className="mt-1 text-sm text-slate-500">View your savings accounts and balances.</p>
        </Link>
        <Link
          to="/member/loans"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
        >
          <HandCoins className="mb-3 h-6 w-6 text-amber-600" />
          <p className="font-display text-base font-bold text-slate-900">Loans</p>
          <p className="mt-1 text-sm text-slate-500">Track loan status, principal, and balance.</p>
        </Link>
        <Link
          to="/member/transactions"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
        >
          <ArrowLeftRight className="mb-3 h-6 w-6 text-violet-600" />
          <p className="font-display text-base font-bold text-slate-900">Transactions</p>
          <p className="mt-1 text-sm text-slate-500">Review deposits, withdrawals, and payments.</p>
        </Link>
      </div>
    </div>
  )
}
