import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ErrorNote, PageHeader, StatusBadge } from '../../components/ui'

export default function SettingsPage() {
  const { profile, institution } = useAuth()
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', currency: 'UGX' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!institution) return
    setForm({
      name: institution.name ?? '',
      phone: institution.phone ?? '',
      email: institution.email ?? '',
      address: institution.address ?? '',
      currency: institution.currency ?? 'UGX',
    })
  }, [institution])

  const canEdit = profile?.role === 'admin' || profile?.role === 'manager'

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!institution || saving) return
    setSaving(true)
    setError('')
    setSaved(false)

    const { error } = await supabase
      .from('institutions')
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        currency: form.currency.trim() || 'UGX',
      })
      .eq('id', institution.id)

    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Institution profile and preferences" />

      {error && <ErrorNote message={error} />}
      {saved && (
        <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          Settings saved.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={handleSave} className="card space-y-4 p-6 lg:col-span-2">
          <h2 className="font-display text-base font-bold text-slate-900">Institution details</h2>

          <div>
            <label className="label">SACCO name *</label>
            <input
              className="input"
              required
              disabled={!canEdit}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                disabled={!canEdit}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                disabled={!canEdit}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input
              className="input"
              disabled={!canEdit}
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="max-w-40">
            <label className="label">Currency</label>
            <input
              className="input"
              disabled={!canEdit}
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
            />
          </div>

          {canEdit ? (
            <div className="flex justify-end pt-1">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              Only admins and managers can edit institution settings.
            </p>
          )}
        </form>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="mb-3 font-display text-base font-bold text-slate-900">Registration</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Reg. number</dt>
                <dd className="font-medium text-slate-800">
                  {institution?.registration_number || '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Status</dt>
                <dd>
                  <StatusBadge status={institution?.status ?? 'inactive'} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-6">
            <h2 className="mb-3 font-display text-base font-bold text-slate-900">Your account</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Name</dt>
                <dd className="font-medium text-slate-800">
                  {profile ? `${profile.first_name} ${profile.last_name}` : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Email</dt>
                <dd className="font-medium text-slate-800">{profile?.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium capitalize text-slate-800">{profile?.role}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}
