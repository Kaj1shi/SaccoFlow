import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { ErrorNote, PageHeader } from '../components/ui'
import { PasswordField } from '../components/PasswordField'
import { passwordMeetsAllRules } from '../lib/password'

export default function AccountSettingsPage() {
  const { profile, refreshProfile } = useAuth()

  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    setForm({
      first_name: profile.first_name ?? '',
      last_name: profile.last_name ?? '',
      phone: profile.phone ?? '',
    })
  }, [profile])

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile || savingProfile) return
    setSavingProfile(true)
    setError('')
    setProfileMsg('')

    const { data, error } = await supabase
      .from('users')
      .update({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
      })
      .eq('id', profile.id)
      .select('id')

    setSavingProfile(false)
    if (error) {
      setError(error.message)
      return
    }
    if ((data?.length ?? 0) === 0) {
      setError('The update was blocked by database permissions (RLS).')
      return
    }
    setProfileMsg('Profile saved.')
    refreshProfile()
  }

  const savePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (savingPassword) return
    setError('')
    setPasswordMsg('')

    if (!passwordMeetsAllRules(password)) {
      setError('Your password does not meet all the requirements listed below the field.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPassword(false)

    if (error) {
      setError(error.message)
      return
    }
    setPassword('')
    setConfirm('')
    setPasswordMsg('Password updated. Use it the next time you sign in.')
  }

  return (
    <div>
      <PageHeader title="My Account" subtitle="Your personal details and sign-in credentials" />

      {error && <ErrorNote message={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="card space-y-4 p-6">
          <h2 className="font-display text-base font-bold text-slate-900">Profile</h2>

          {profileMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {profileMsg}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
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
            <label className="label">Email</label>
            <input className="input" value={profile?.email ?? ''} disabled />
            <p className="mt-1.5 text-xs text-slate-400">
              Your email is your sign-in identity and can't be changed here.
            </p>
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" className="btn-primary" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>

        <form onSubmit={savePassword} className="card h-fit space-y-4 p-6">
          <h2 className="font-display text-base font-bold text-slate-900">Change password</h2>

          {passwordMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {passwordMsg}
            </div>
          )}

          <PasswordField
            id="account-new-password"
            label="New password *"
            value={password}
            onChange={setPassword}
            showChecklist
          />
          <PasswordField
            id="account-confirm-password"
            label="Confirm new password *"
            value={confirm}
            onChange={setConfirm}
          />

          <div className="flex justify-end pt-1">
            <button type="submit" className="btn-primary" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
