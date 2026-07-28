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
import SuperOverviewPage from './pages/super/SuperOverviewPage'
import RegistrationsPage from './pages/super/RegistrationsPage'
import UsersPage from './pages/super/UsersPage'
import AuditLogsPage from './pages/super/AuditLogsPage'
import { Spinner } from './components/ui'
import { loginPageUrl } from './lib/site'

function RequireAuth() {
  const { session, profile, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading your workspace…" />
      </div>
    )
  }
  if (!session || !profile) {
    // The site's login.html handles sign-in. The internal /login page is a
    // fallback for running the dashboard on its own with `npm run dev`.
    if (import.meta.env.DEV) return <Navigate to="/login" replace />
    window.location.href = loginPageUrl()
    return null
  }
  return <Outlet />
}

function RequireSuper() {
  const { isSuperAdmin } = useAuth()
  if (!isSuperAdmin) return <Navigate to="/" replace />
  return <Outlet />
}

function HomeRedirect() {
  const { isSuperAdmin } = useAuth()
  return isSuperAdmin ? <Navigate to="/super" replace /> : <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<RequireAuth />}>
            {/* SACCO staff dashboard */}
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

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
