import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../lib/format'
import { EmptyState, PageHeader, Spinner } from '../../components/ui'

// Brand blues first (from saccoflow.css), then supporting accents
const PIE_COLORS = ['#2f55d4', '#5ebcff', '#f59e0b', '#8b5cf6', '#ef4444']

interface MonthPoint {
  month: string
  deposits: number
  withdrawals: number
}

interface SlicePoint {
  name: string
  value: number
}

export default function ReportsPage() {
  const { profile } = useAuth()
  const [monthly, setMonthly] = useState<MonthPoint[]>([])
  const [loanMix, setLoanMix] = useState<SlicePoint[]>([])
  const [memberGrowth, setMemberGrowth] = useState<{ month: string; members: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const instId = profile.institution_id
    let cancelled = false

    async function load() {
      const start = new Date()
      start.setMonth(start.getMonth() - 11)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)

      const [txRes, loanRes, memberRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('transaction_type, amount, transaction_date')
          .eq('institution_id', instId)
          .eq('status', 'completed')
          .gte('transaction_date', start.toISOString()),
        supabase
          .from('loans')
          .select('loan_type, principal_amount, members!member_id!inner(institution_id)')
          .eq('members.institution_id', instId),
        supabase
          .from('members')
          .select('created_at')
          .eq('institution_id', instId)
          .order('created_at'),
      ])

      if (cancelled) return

      // Monthly cash flow
      const months: MonthPoint[] = []
      const monthIndex = new Map<string, MonthPoint>()
      for (let i = 0; i < 12; i++) {
        const d = new Date(start)
        d.setMonth(start.getMonth() + i)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const point = {
          month: d.toLocaleDateString('en-UG', { month: 'short' }),
          deposits: 0,
          withdrawals: 0,
        }
        months.push(point)
        monthIndex.set(key, point)
      }
      for (const t of txRes.data ?? []) {
        const key = String(t.transaction_date).slice(0, 7)
        const point = monthIndex.get(key)
        if (!point) continue
        if (t.transaction_type === 'deposit' || t.transaction_type === 'loan_repayment') {
          point.deposits += Number(t.amount || 0)
        } else if (t.transaction_type === 'withdrawal' || t.transaction_type === 'loan_disbursement') {
          point.withdrawals += Number(t.amount || 0)
        }
      }

      // Loan portfolio mix
      const mix = new Map<string, number>()
      for (const l of loanRes.data ?? []) {
        const key = String(l.loan_type)
        mix.set(key, (mix.get(key) ?? 0) + Number(l.principal_amount || 0))
      }

      // Member growth (cumulative by month)
      const growth: { month: string; members: number }[] = []
      const growthIndex = new Map<string, number>()
      for (let i = 0; i < 12; i++) {
        const d = new Date(start)
        d.setMonth(start.getMonth() + i)
        growthIndex.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, i)
        growth.push({ month: d.toLocaleDateString('en-UG', { month: 'short' }), members: 0 })
      }
      let before = 0
      for (const m of memberRes.data ?? []) {
        const key = String(m.created_at).slice(0, 7)
        const idx = growthIndex.get(key)
        if (idx === undefined) {
          if (String(m.created_at) < start.toISOString()) before += 1
          continue
        }
        growth[idx].members += 1
      }
      let running = before
      for (const g of growth) {
        running += g.members
        g.members = running
      }

      setMonthly(months)
      setLoanMix([...mix.entries()].map(([name, value]) => ({ name, value })))
      setMemberGrowth(growth)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  if (loading) return <Spinner />

  const hasCashflow = monthly.some((m) => m.deposits > 0 || m.withdrawals > 0)

  return (
    <div>
      <PageHeader title="Reports" subtitle="Trends across the last 12 months" />

      <div className="mb-6 card p-5">
        <h2 className="mb-4 font-display text-base font-bold text-slate-900">
          Monthly cash flow
        </h2>
        {hasCashflow ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v: number) => (v >= 1_000_000 ? `${v / 1_000_000}M` : v >= 1000 ? `${v / 1000}K` : String(v))}
                  width={48}
                />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="deposits" name="Money in" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="withdrawals" name="Money out" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-slate-400">
            No completed transactions in the last 12 months.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-slate-900">
            Loan portfolio by type
          </h2>
          {loanMix.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">No loans recorded yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={loanMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {loanMix.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Legend wrapperStyle={{ fontSize: 12, textTransform: 'capitalize' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-display text-base font-bold text-slate-900">Member growth</h2>
          {memberGrowth.every((g) => g.members === 0) ? (
            <EmptyState title="No members yet" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={memberGrowth} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} width={36} />
                  <Tooltip />
                  <Bar dataKey="members" name="Total members" fill="#2f55d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
