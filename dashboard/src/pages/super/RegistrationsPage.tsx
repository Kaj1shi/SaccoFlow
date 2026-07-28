import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../lib/format'
import {
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { Institution } from '../../types'

const STATUS_FILTERS = ['all', 'inactive', 'active', 'suspended'] as const

export default function RegistrationsPage() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const [selected, setSelected] = useState<Institution | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setError('')
    const { data, error } = await supabase
      .from('institutions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setInstitutions((data as Institution[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return institutions.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (!q) return true
      return (
        i.name.toLowerCase().includes(q) ||
        (i.registration_number ?? '').toLowerCase().includes(q) ||
        (i.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [institutions, query, statusFilter])

  const rejectInstitution = async (inst: Institution) => {
    const ok = window.confirm(
      `Reject and permanently remove "${inst.name}"? This deletes the registration and its staff accounts. This cannot be undone.`
    )
    if (!ok) return

    setBusyId(inst.id)
    setError('')
    const { data, error } = await supabase
      .from('institutions')
      .delete()
      .eq('id', inst.id)
      .select('id')

    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    if ((data?.length ?? 0) === 0) {
      setError(
        'The rejection was blocked by database permissions. Make sure the super admin RLS policies are applied (run supabase/schemas/fix-rls-policies.sql).'
      )
      return
    }
    setSelected(null)
    load()
  }

  const setStatus = async (inst: Institution, status: Institution['status']) => {
    setBusyId(inst.id)
    setError('')
    const { data, error } = await supabase
      .from('institutions')
      .update({ status })
      .eq('id', inst.id)
      .select('id')

    if (!error && (data?.length ?? 0) === 0) {
      // RLS silently filtered the update — no row was touched
      setBusyId(null)
      setError(
        'The update was blocked by database permissions. Make sure the super admin RLS policies are applied (run supabase/schemas/fix-rls-policies.sql).'
      )
      return
    }

    // Activate the SACCO's users alongside approval
    if (!error && status === 'active') {
      await supabase.from('users').update({ is_active: true }).eq('institution_id', inst.id)
    }

    setBusyId(null)
    if (error) {
      setError(error.message)
      return
    }
    setSelected(null)
    load()
  }

  if (loading) return <Spinner />

  const settings = (selected?.settings ?? {}) as Record<string, string>

  return (
    <div>
      <PageHeader
        title="SACCO registrations"
        subtitle="Approve, suspend or review registered SACCOs"
      />

      {error && <ErrorNote message={error} />}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name, reg number, email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === s
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {s === 'inactive' ? 'pending' : s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No SACCOs match your filters" />
      ) : (
        <TableShell
          headers={['SACCO', 'Reg. number', 'Contact', 'Registered', 'Status', '']}
          footer={`Showing ${filtered.length} of ${institutions.length} SACCOs`}
        >
          {filtered.map((i) => (
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
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setSelected(i)}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Review
                </button>
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal
        open={!!selected}
        title={selected?.name ?? 'SACCO details'}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-4">
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Registration number</dt>
                <dd className="font-medium text-slate-800">
                  {selected.registration_number || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-800">{selected.email || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Phone</dt>
                <dd className="font-medium text-slate-800">{selected.phone || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Contact person</dt>
                <dd className="font-medium text-slate-800">{settings.contact_person || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Expected members</dt>
                <dd className="font-medium text-slate-800">{settings.members_range || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Registered</dt>
                <dd className="font-medium text-slate-800">{formatDate(selected.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={selected.status} />
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              {selected.status === 'inactive' && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busyId === selected.id}
                  onClick={() => rejectInstitution(selected)}
                >
                  Reject & remove
                </button>
              )}
              {selected.status !== 'active' && (
                <button
                  type="button"
                  className="btn-primary"
                  disabled={busyId === selected.id}
                  onClick={() => setStatus(selected, 'active')}
                >
                  {busyId === selected.id ? 'Working…' : 'Approve & activate'}
                </button>
              )}
              {selected.status === 'active' && (
                <button
                  type="button"
                  className="btn-danger"
                  disabled={busyId === selected.id}
                  onClick={() => setStatus(selected, 'suspended')}
                >
                  {busyId === selected.id ? 'Working…' : 'Suspend'}
                </button>
              )}
              {selected.status === 'suspended' && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busyId === selected.id}
                  onClick={() => setStatus(selected, 'active')}
                >
                  Reactivate
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
