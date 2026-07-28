import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftRight, HandCoins, PiggyBank, Users } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDateTime, formatMoney, formatNumber, fullName } from '../../lib/format'
import { EmptyState, PageHeader, Spinner, StatCard, StatusBadge, TableShell } from '../../components/ui'
import type { Transaction } from '../../types'

interface DashStats {
  members: number
  totalSavings: number
  loansOutstanding: number
  txToday: number
}

interface DayPoint {
  day: string
  deposits: number
  withdrawals: number
}

export default function DashboardPage() {
  const { profile, institution } = useAuth()
  const [stats, setStats] = useState<DashStats | null>(null)
  const [series, setSeries] = useState<DayPoint[]>([])
  const [recent, setRecent] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const instId = profile.institution_id
    let cancelled = false

    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 29)
      const sinceIso = since.toISOString()
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [membersRes, savingsRes, loansRes, txTodayRes, txMonthRes, recentRes] =
        await Promise.all([
          supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('institution_id', instId),
          supabase
            .from('savings_accounts')
            .select('balance, members!inner(institution_id)')
            .eq('members.institution_id', instId)
            .eq('status', 'active'),
          supabase
            .from('loans')
            .select('balance, members!member_id!inner(institution_id)')
            .eq('members.institution_id', instId)
            .in('status', ['in_progress', 'overdue', 'approved']),
          supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('institution_id', instId)
            .gte('transaction_date', todayStart.toISOString()),
          supabase
            .from('transactions')
            .select('transaction_type, amount, transaction_date')
            .eq('institution_id', instId)
            .eq('status', 'completed')
            .gte('transaction_date', sinceIso),
          supabase
            .from('transactions')
            .select('*, members(first_name,last_name,member_number)')
            .eq('institution_id', instId)
            .order('transaction_date', { ascending: false })
            .limit(8),
        ])

      if (cancelled) return

      const totalSavings = (savingsRes.data ?? []).reduce(
        (sum, r: { balance: number }) => sum + Number(r.balance || 0),
        0
      )
      const loansOutstanding = (loansRes.data ?? []).reduce(
        (sum, r: { balance: number }) => sum + Number(r.balance || 0),
        0
      )

      // Build 30-day deposit/withdrawal series
      const byDay = new Map<string, DayPoint>()
      for (let i = 0; i < 30; i++) {
        const d = new Date(since)
        d.setDate(since.getDate() + i)
        const key = d.toISOString().slice(0, 10)
        byDay.set(key, {
          day: d.toLocaleDateString('en-UG', { month: 'short', day: 'numeric' }),
          deposits: 0,
          withdrawals: 0,
        })
      }
      for (const t of txMonthRes.data ?? []) {
        const key = String(t.transaction_date).slice(0, 10)
        const point = byDay.get(key)
        if (!point) continue
        if (t.transaction_type === 'deposit' || t.transaction_type === 'loan_repayment') {
          point.deposits += Number(t.amount || 0)
        } else if (
          t.transaction_type === 'withdrawal' ||
          t.transaction_type === 'loan_disbursement'
        ) {
          point.withdrawals += Number(t.amount || 0)
        }
      }

      setStats({
        members: membersRes.count ?? 0,
        totalSavings,
        loansOutstanding,
        txToday: txTodayRes.count ?? 0,
      })
      setSeries([...byDay.values()])
      setRecent((recentRes.data as Transaction[]) ?? [])
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
        title={`Welcome back, ${profile?.first_name} 👋`}
        subtitle={`Here's what's happening at ${institution?.name ?? 'your SACCO'} today.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total members"
          value={formatNumber(stats?.members)}
          icon={<Users className="h-5 w-5" />}
          tint="brand"
        />
        <StatCard
          label="Total savings"
          value={formatMoney(stats?.totalSavings)}
          icon={<PiggyBank className="h-5 w-5" />}
          tint="emerald"
        />
        <StatCard
          label="Loans outstanding"
          value={formatMoney(stats?.loansOutstanding)}
          icon={<HandCoins className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label="Transactions today"
          value={formatNumber(stats?.txToday)}
          icon={<ArrowLeftRight className="h-5 w-5" />}
          tint="purple"
        />
      </div>

      <div className="mb-6 card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            Cash flow — last 30 days
          </h2>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Money in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Money out
            </span>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={28} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickFormatter={(v: number) => (v >= 1_000_000 ? `${v / 1_000_000}M` : v >= 1000 ? `${v / 1000}K` : String(v))}
                width={48}
              />
              <Tooltip formatter={(value) => formatMoney(Number(value))} />
              <Area type="monotone" dataKey="deposits" name="Money in" stroke="#16a34a" strokeWidth={2} fill="url(#gIn)" />
              <Area type="monotone" dataKey="withdrawals" name="Money out" stroke="#ef4444" strokeWidth={2} fill="url(#gOut)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-slate-900">Recent transactions</h2>
        <Link to="/transactions" className="text-sm font-medium text-brand-600 hover:underline">
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          hint="Record your first deposit from the Transactions page."
        />
      ) : (
        <TableShell headers={['Reference', 'Member', 'Type', 'Amount', 'Date', 'Status']}>
          {recent.map((t) => (
            <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-800">{t.transaction_number}</td>
              <td className="px-4 py-3 text-slate-600">
                {t.members ? fullName(t.members) : '—'}
              </td>
              <td className="px-4 py-3 capitalize text-slate-600">
                {t.transaction_type.replace(/_/g, ' ')}
              </td>
              <td className="px-4 py-3 font-semibold text-slate-800">{formatMoney(t.amount)}</td>
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
