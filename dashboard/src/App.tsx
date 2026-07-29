import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import MembersPage from './pages/admin/MembersPage'
import SavingsPage from './pages/admin/SavingsPage'
import LoansPage from './pages/admin/LoansPage'
import TransactionsPage from './pages/admin/TransactionsPage'
import ReportsPage from './pages/admin/ReportsPage'
import SettingsPage from './pages/admin/SettingsPage'
import AccountSettingsPage from './pages/AccountSettingsPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MemberHomePage from './pages/member/MemberHomePage'
import SuperOverviewPage from './pages/super/SuperOverviewPage'
import RegistrationsPage from './pages/super/RegistrationsPage'
import UsersPage from './pages/super/UsersPage'
import AuditLogsPage from './pages/super/AuditLogsPage'
import { Spinner } from './components/ui'
import { loginPageUrl } from './lib/site'
import { supabase } from './lib/supabase'

function redirectToLogin() {
  // replace() so Back does not restore a signed-out dashboard entry
  window.location.replace(loginPageUrl())
}

function AuthLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-slate-50">
      <Spinner label={label} />
    </div>
  )
}

function RequireAuth() {
  const { session, profile, loading } = useAuth()
  const signedOut = !loading && (!session || !profile)

  useEffect(() => {
    if (!signedOut) return
    // Drop a stale Auth session that has no app profile so we don't loop
    if (session && !profile) {
      void supabase.auth.signOut({ scope: 'local' })
    }
    if (import.meta.env.DEV) return
    redirectToLogin()
  }, [signedOut, session, profile])

  if (loading) return <AuthLoading label="Loading your workspace…" />
  if (!session || !profile) {
    if (import.meta.env.DEV) return <Navigate to="/login" replace />
    return <AuthLoading label="Redirecting to sign in…" />
  }
  return <Outlet />
}

function FallbackRoute() {
  const { session, profile, loading, isSuperAdmin } = useAuth()

  useEffect(() => {
    if (loading) return
    if (session && profile) return
    if (import.meta.env.DEV) return
    redirectToLogin()
  }, [loading, session, profile])

  if (loading) return <AuthLoading label="Loading…" />
  if (!session || !profile) {
    if (import.meta.env.DEV) return <Navigate to="/login" replace />
    return <AuthLoading label="Redirecting to sign in…" />
  }
  if (isSuperAdmin) return <Navigate to="/super" replace />
  if (profile.role === 'member') return <Navigate to="/member" replace />
  return <Navigate to="/" replace />
}

function RequireStaff() {
  const { profile, isSuperAdmin } = useAuth()
  if (profile?.role === 'member' && !isSuperAdmin) {
    return <Navigate to="/member" replace />
  }
  return <Outlet />
}

function RequireMember() {
  const { profile, isSuperAdmin } = useAuth()
  if (isSuperAdmin) return <Navigate to="/super" replace />
  if (profile?.role !== 'member') return <Navigate to="/" replace />
  return <Outlet />
}

function RequireSuper() {
  const { isSuperAdmin } = useAuth()
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

function HomeRedirect() {
  const { isSuperAdmin, profile } = useAuth()
  if (isSuperAdmin) return <Navigate to="/super" replace />
  if (profile?.role === 'member') return <Navigate to="/member" replace />
  return <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            {/* Member portal */}
            <Route element={<RequireMember />}>
              <Route element={<AppLayout variant="member" />}>
                <Route path="member" element={<MemberHomePage />} />
                <Route path="member/account" element={<AccountSettingsPage />} />
              </Route>
            </Route>

            {/* SACCO staff dashboard */}
            <Route element={<RequireStaff />}>
              <Route element={<AppLayout variant="admin" />}>
                <Route index element={<HomeRedirect />} />
                <Route path="members" element={<MembersPage />} />
                <Route path="savings" element={<SavingsPage />} />
                <Route path="loans" element={<LoansPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="account" element={<AccountSettingsPage />} />
              </Route>
            </Route>

            {/* Platform super admin console */}
            <Route element={<RequireSuper />}>
              <Route element={<AppLayout variant="super" />}>
                <Route path="super" element={<SuperOverviewPage />} />
                <Route path="super/registrations" element={<RegistrationsPage />} />
                <Route path="super/users" element={<UsersPage />} />
                <Route path="super/audit" element={<AuditLogsPage />} />
                <Route path="super/account" element={<AccountSettingsPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<FallbackRoute />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
