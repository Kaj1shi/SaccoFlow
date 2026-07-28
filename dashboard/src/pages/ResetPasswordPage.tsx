import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { PasswordField } from '../components/PasswordField'
import { passwordMeetsAllRules } from '../lib/password'
import { Spinner } from '../components/ui'
import { loginPageUrl } from '../lib/site'

export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Give supabase-js a moment to consume the recovery tokens from the URL
  // before declaring the link invalid.
  const [graceOver, setGraceOver] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setGraceOver(true), 2000)
    return () => clearTimeout(t)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')

    if (!passwordMeetsAllRules(password)) {
      setError('Your password does not meet all the requirements listed below.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-full items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
            <Banknote className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">
            Sacco<span className="text-brand-600">Flow</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Reset your password</p>
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
      </div>
    </div>
  )

  if (loading || (!session && !graceOver)) {
    return shell(<Spinner label="Checking your reset link…" />)
  }

  if (!session) {
    return shell(
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">
          This reset link is invalid or has expired.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Request a new one from the login page and use it within an hour.
        </p>
        <a href={loginPageUrl()} className="btn-primary mt-5 inline-flex">
          Back to login
        </a>
      </div>
    )
  }

  if (done) {
    return shell(
      <div className="text-center">
        <p className="text-sm font-medium text-slate-700">Your password has been updated.</p>
        <p className="mt-2 text-sm text-slate-500">You're signed in and ready to go.</p>
        <button type="button" className="btn-primary mt-5" onClick={() => navigate('/', { replace: true })}>
          Go to dashboard
        </button>
      </div>
    )
  }

  return shell(
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <PasswordField
        id="new-password"
        label="New password"
        value={password}
        onChange={setPassword}
        showChecklist
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        value={confirm}
        onChange={setConfirm}
      />

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Updating…' : 'Set new password'}
      </button>
    </form>
  )
}
