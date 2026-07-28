import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, CheckCircle2, Clock, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, formatNumber } from '../../lib/format'
import { EmptyState, PageHeader, Spinner, StatCard, StatusBadge, TableShell } from '../../components/ui'
import type { Institution } from '../../types'

export default function SuperOverviewPage() {
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, users: 0 })
  const [recent, setRecent] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const [allRes, activeRes, pendingRes, usersRes, recentRes] = await Promise.all([
        supabase.from('institutions').select('id', { count: 'exact', head: true }),
        supabase
          .from('institutions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('institutions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'inactive'),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase
          .from('institutions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      if (cancelled) return
      setStats({
        total: allRes.count ?? 0,
        active: activeRes.count ?? 0,
        pending: pendingRes.count ?? 0,
        users: usersRes.count ?? 0,
      })
      setRecent((recentRes.data as Institution[]) ?? [])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Platform overview"
        subtitle="All SACCOs registered on SaccoFlow"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total SACCOs"
          value={formatNumber(stats.total)}
          icon={<Building2 className="h-5 w-5" />}
          tint="brand"
        />
        <StatCard
          label="Active SACCOs"
          value={formatNumber(stats.active)}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tint="emerald"
        />
        <StatCard
          label="Pending approval"
          value={formatNumber(stats.pending)}
          icon={<Clock className="h-5 w-5" />}
          tint="amber"
        />
        <StatCard
          label="System users"
          value={formatNumber(stats.users)}
          icon={<Users className="h-5 w-5" />}
          tint="purple"
        />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-slate-900">Latest registrations</h2>
        <Link
          to="/super/registrations"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Manage all
        </Link>
      </div>

      {recent.length === 0 ? (
        <EmptyState title="No SACCOs registered yet" />
      ) : (
        <TableShell headers={['SACCO', 'Reg. number', 'Contact', 'Registered', 'Status']}>
          {recent.map((i) => (
            <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3 font-medium text-slate-800">{i.name}</td>
              <td className="px-4 py-3 text-slate-600">{i.registration_number || '—'}</td>
              <td className="px-4 py-3 text-slate-600">
                {i.email || '—'}
                <p className="text-xs text-slate-400">{i.phone || ''}</p>
              </td>
              <td className="px-4 py-3 text-slate-500">{formatDate(i.created_at)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={i.status} />
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  )
}
