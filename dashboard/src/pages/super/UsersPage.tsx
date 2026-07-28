import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate, fullName } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
  PageHeader,
  Spinner,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { Profile } from '../../types'

interface UserRow extends Profile {
  created_at: string
  institutions?: { name: string } | null
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  const load = async () => {
    setError('')
    const { data, error } = await supabase
      .from('users')
      .select('*, institutions(name)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setUsers((data as UserRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        fullName(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.institutions?.name ?? '').toLowerCase().includes(q)
    )
  }, [users, query])

  const toggleActive = async (u: UserRow) => {
    const { data, error } = await supabase
      .from('users')
      .update({ is_active: !u.is_active })
      .eq('id', u.id)
      .select('id')
    if (error) {
      setError(error.message)
    } else if ((data?.length ?? 0) === 0) {
      setError(
        'The update was blocked by database permissions. Make sure the super admin RLS policies are applied (run supabase/schemas/fix-rls-policies.sql).'
      )
    } else {
      load()
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader title="Users" subtitle={`${users.length} system users across all SACCOs`} />

      {error && <ErrorNote message={error} />}

      <div className="relative mb-4 min-w-56 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search user or SACCO…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No users match your search" />
      ) : (
        <TableShell
          headers={['User', 'SACCO', 'Role', 'Joined', 'Status', '']}
          footer={`Showing ${filtered.length} of ${users.length} users`}
        >
          {filtered.map((u) => (
            <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{fullName(u)}</p>
                <p className="text-xs text-slate-400">{u.email}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{u.institutions?.name ?? '—'}</td>
              <td className="px-4 py-3 capitalize text-slate-600">{u.role}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={u.is_active ? 'active' : 'inactive'} />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => toggleActive(u)}
                  className={`text-xs font-medium hover:underline ${
                    u.is_active ? 'text-orange-600' : 'text-brand-600'
                  }`}
                >
                  {u.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </TableShell>
      )}
    </div>
  )
}
