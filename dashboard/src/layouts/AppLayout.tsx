import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Building2,
  ClipboardList,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { loginPageUrl } from '../lib/site'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  end?: boolean
}

const adminNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, end: true },
  { to: '/members', label: 'Members', icon: <Users className="h-5 w-5" /> },
  { to: '/savings', label: 'Savings', icon: <PiggyBank className="h-5 w-5" /> },
  { to: '/loans', label: 'Loans', icon: <HandCoins className="h-5 w-5" /> },
  { to: '/transactions', label: 'Transactions', icon: <ArrowLeftRight className="h-5 w-5" /> },
  { to: '/reports', label: 'Reports', icon: <BarChart3 className="h-5 w-5" /> },
  { to: '/settings', label: 'Settings', icon: <Settings className="h-5 w-5" /> },
]

const superNav: NavItem[] = [
  { to: '/super', label: 'Overview', icon: <LayoutDashboard className="h-5 w-5" />, end: true },
  { to: '/super/registrations', label: 'SACCO Registrations', icon: <Building2 className="h-5 w-5" /> },
  { to: '/super/users', label: 'Users', icon: <ShieldCheck className="h-5 w-5" /> },
  { to: '/super/audit', label: 'Audit Logs', icon: <ClipboardList className="h-5 w-5" /> },
]

const memberNav: NavItem[] = [
  { to: '/member', label: 'My dashboard', icon: <LayoutDashboard className="h-5 w-5" />, end: true },
]

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
    isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white',
  ].join(' ')

function SidebarContent({
  items,
  brandSub,
  accountTo,
  onNavigate,
  onClose,
  onSignOut,
}: {
  items: NavItem[]
  brandSub: string
  accountTo: string
  onNavigate?: () => void
  onClose: () => void
  onSignOut: () => void
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 px-5 pb-6 pt-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Banknote className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-extrabold leading-tight text-white">
              Sacco<span className="text-brand-400">Flow</span>
            </p>
            <p className="truncate text-xs text-white/50">{brandSub}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} onClick={onNavigate} className={navItemClass}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section: account settings + sign out */}
      <div className="space-y-1 border-t border-white/10 px-3 py-3">
        <NavLink to={accountTo} onClick={onNavigate} className={navItemClass}>
          <UserCog className="h-5 w-5" />
          My Account
        </NavLink>
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          Sign out
        </button>
      </div>

      <p className="px-5 pb-4 pt-1 text-[11px] text-white/30">© {new Date().getFullYear()} SaccoFlow</p>
    </div>
  )
}

export default function AppLayout({ variant }: { variant: 'admin' | 'super' | 'member' }) {
  const { profile, institution, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const items = variant === 'super' ? superNav : variant === 'member' ? memberNav : adminNav
  const accountTo =
    variant === 'super' ? '/super/account' : variant === 'member' ? '/member/account' : '/account'
  const brandSub =
    variant === 'super'
      ? 'Platform Console'
      : variant === 'member'
        ? 'Member portal'
        : (institution?.name ?? 'SACCO Dashboard')
  const name = profile ? `${profile.first_name} ${profile.last_name}` : ''

  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches

  const handleMenuClick = () => {
    if (isDesktop()) setCollapsed((v) => !v)
    else setMobileOpen(true)
  }

  const handleSignOut = async () => {
    await signOut()
    // Always hard-replace so history Back cannot reopen a signed-out dashboard shell
    if (import.meta.env.DEV) {
      navigate('/login', { replace: true })
      return
    }
    window.location.replace(loginPageUrl())
  }

  return (
    <div className="flex h-full">
      {!collapsed && (
        <aside className="hidden w-64 shrink-0 bg-brand-900 lg:block">
          <SidebarContent
            items={items}
            brandSub={brandSub}
            accountTo={accountTo}
            onClose={() => setCollapsed(true)}
            onSignOut={handleSignOut}
          />
        </aside>
      )}

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-brand-900 shadow-xl">
            <SidebarContent
              items={items}
              brandSub={brandSub}
              accountTo={accountTo}
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
              onSignOut={handleSignOut}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 ${collapsed ? '' : 'lg:hidden'}`}
              onClick={handleMenuClick}
              aria-label="Open menu"
              title="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="hidden text-sm text-slate-400 sm:block">
              {variant === 'super'
                ? 'SaccoFlow Platform Administration'
                : variant === 'member'
                  ? 'Member portal'
                  : institution?.name}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {initials(name)}
            </span>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight text-slate-800">{name}</p>
              <p className="text-xs capitalize leading-tight text-slate-400">
                {variant === 'super' ? 'super admin' : profile?.role}
              </p>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
