/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Institution, Profile } from '../types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  institution: Institution | null
  isSuperAdmin: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

async function loadProfile(userId: string): Promise<{
  profile: Profile | null
  institution: Institution | null
}> {
  const { data: profile } = await supabase
    .from('users')
    .select(
      'id, institution_id, branch_id, email, first_name, last_name, phone, role, is_active, permissions'
    )
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return { profile: null, institution: null }

  const { data: institution } = await supabase
    .from('institutions')
    .select('*')
    .eq('id', profile.institution_id)
    .maybeSingle()

  return { profile: profile as Profile, institution: (institution as Institution) ?? null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function bootstrap(s: Session | null) {
      if (!s?.user) {
        if (!cancelled) {
          setProfile(null)
          setInstitution(null)
          setLoading(false)
        }
        return
      }
      const { profile, institution } = await loadProfile(s.user.id)
      if (!cancelled) {
        setProfile(profile)
        setInstitution(institution)
        setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      bootstrap(data.session)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      bootstrap(s)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message

    const { profile } = await loadProfile(data.user.id)
    if (!profile) {
      await supabase.auth.signOut()
      return 'Your account has no dashboard profile. Contact your administrator.'
    }
    if (profile.role === 'member') {
      await supabase.auth.signOut()
      return 'Member accounts cannot access the staff dashboard.'
    }
    if (!profile.is_active) {
      await supabase.auth.signOut()
      return 'Your account is deactivated. Contact your administrator.'
    }
    return null
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (!session?.user) return
    const { profile, institution } = await loadProfile(session.user.id)
    setProfile(profile)
    setInstitution(institution)
  }

  const isSuperAdmin = Boolean(
    profile?.permissions && (profile.permissions as Record<string, unknown>).is_super_admin === true
  )

  return (
    <AuthContext.Provider
      value={{ session, profile, institution, isSuperAdmin, loading, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
