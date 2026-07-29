import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatDate, fullName, genRef } from '../../lib/format'
import { inviteMemberPortal } from '../../lib/memberInvite'
import {
  EmptyState,
  ErrorNote,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  TableShell,
} from '../../components/ui'
import type { Member } from '../../types'

const STATUS_FILTERS = ['all', 'active', 'pending', 'suspended', 'inactive'] as const

export default function MembersPage() {
  const { profile } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all')
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    gender: 'female',
    date_of_birth: '',
    phone: '',
    email: '',
    national_id: '',
    address: '',
  })

  const load = async () => {
    if (!profile) return
    setError('')
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('institution_id', profile.institution_id)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    setMembers((data as Member[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false
      if (!q) return true
      return (
        fullName(m).toLowerCase().includes(q) ||
        m.member_number.toLowerCase().includes(q) ||
        (m.phone ?? '').toLowerCase().includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      )
    })
  }, [members, query, statusFilter])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || saving) return

    const email = form.email.trim().toLowerCase()
    if (!email) {
      setError('Email is required so the member can receive a portal invite.')
      return
    }

    setSaving(true)
    setError('')
    setInfo('')

    const { data: created, error } = await supabase
      .from('members')
      .insert({
        institution_id: profile.institution_id,
        member_number: genRef('MEM'),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        gender: form.gender,
        date_of_birth: form.date_of_birth,
        phone: form.phone.trim() || null,
        email,
        national_id: form.national_id.trim() || null,
        address: form.address.trim() || null,
        status: 'active',
        created_by: profile.id,
      })
      .select('*')
      .single()

    if (error || !created) {
      setSaving(false)
      setError(error?.message || 'Could not create member.')
      return
    }

    const invite = await inviteMemberPortal({
      memberId: created.id,
      institutionId: profile.institution_id,
      email,
      firstName: form.first_name.trim(),
      lastName: form.last_name.trim(),
      phone: form.phone.trim() || null,
    })

    setSaving(false)
    setShowAdd(false)
    setForm({
      first_name: '',
      last_name: '',
      gender: 'female',
      date_of_birth: '',
      phone: '',
      email: '',
      national_id: '',
      address: '',
    })

    if (invite.ok) {
      setInfo(
        `Member added. An invite email was sent to ${email} so they can set a password and open their portal.`
      )
    } else {
      setError(`Member was saved, but the portal invite failed: ${invite.error}`)
    }
    load()
  }

  const setStatus = async (member: Member, status: Member['status']) => {
    const { error } = await supabase.from('members').update({ status }).eq('id', member.id)
    if (error) setError(error.message)
    else load()
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${members.length} registered member${members.length === 1 ? '' : 's'} · email invite opens their portal`}
        actions={
          <button type="button" className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add member
          </button>
        }
      />

      {error && <ErrorNote message={error} />}
      {info && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {info}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name, number, phone…"
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
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={members.length === 0 ? 'No members yet' : 'No members match your search'}
          hint={members.length === 0 ? 'Add your first member to get started.' : undefined}
        />
      ) : (
        <TableShell
          headers={['Member', 'Member No.', 'Phone', 'Joined', 'Status', '']}
          footer={`Showing ${filtered.length} of ${members.length} members`}
        >
          {filtered.map((m) => (
            <tr key={m.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{fullName(m)}</p>
                <p className="text-xs text-slate-400">{m.email || '—'}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">{m.member_number}</td>
              <td className="px-4 py-3 text-slate-600">{m.phone || '—'}</td>
              <td className="px-4 py-3 text-slate-500">{formatDate(m.registration_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={m.status} />
              </td>
              <td className="px-4 py-3 text-right">
                {m.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setStatus(m, 'suspended')}
                    className="text-xs font-medium text-orange-600 hover:underline"
                  >
                    Suspend
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStatus(m, 'active')}
                    className="text-xs font-medium text-brand-600 hover:underline"
                  >
                    Activate
                  </button>
                )}
              </td>
            </tr>
          ))}
        </TableShell>
      )}

      <Modal open={showAdd} title="Add new member" onClose={() => setShowAdd(false)} wide>
        <form onSubmit={handleAdd} className="grid gap-4 sm:grid-cols-2">
          <p className="text-sm text-slate-500 sm:col-span-2">
            Email is required. We create their portal login and send an invite so they can set a
            password.
          </p>
          <div>
            <label className="label">First name *</label>
            <input
              className="input"
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Last name *</label>
            <input
              className="input"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Gender *</label>
            <select
              className="input"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Date of birth *</label>
            <input
              type="date"
              className="input"
              required
              value={form.date_of_birth}
              onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              placeholder="+256 7xx xxx xxx"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Email *</label>
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">National ID</label>
            <input
              className="input"
              value={form.national_id}
              onChange={(e) => setForm({ ...form, national_id: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Adding & inviting…' : 'Add member & send invite'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
