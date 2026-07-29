import { supabase } from './supabase'

/** Password that satisfies our client-side rules (invite temp only). */
export function randomInvitePassword(): string {
  const rand = crypto.randomUUID().replace(/-/g, '')
  return `Aa1!${rand.slice(0, 12)}`
}

function resetPasswordRedirect(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}reset-password`.replace(
    /([^:]\/)\/+/g,
    '$1'
  )
}

/**
 * Create Auth user + users profile for a member without replacing the admin session.
 * Uses raw Auth HTTP APIs (not supabase.auth.signUp) so the staff session stays put,
 * then sends a recovery email so the member sets their own password.
 */
export async function inviteMemberPortal(opts: {
  memberId: string
  institutionId: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const email = opts.email.trim().toLowerCase()
  const fullName = `${opts.firstName} ${opts.lastName}`.trim()
  const tempPassword = randomInvitePassword()

  const signupRes = await fetch(`${url}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: tempPassword,
      data: {
        full_name: fullName,
        phone: opts.phone || '',
        institution_id: opts.institutionId,
        member_id: opts.memberId,
        role: 'member',
      },
    }),
  })
  const signupJson = await signupRes.json().catch(() => ({}))
  if (!signupRes.ok) {
    const msg =
      signupJson.msg ||
      signupJson.error_description ||
      signupJson.error ||
      'Could not create the member login.'
    if (/already|registered|exists/i.test(String(msg))) {
      return {
        ok: false,
        error:
          'That email already has a login. Use a different email, or ask them to use Forgot password.',
      }
    }
    if (/rate limit|too many/i.test(String(msg))) {
      return {
        ok: false,
        error:
          'Email rate limit reached. Member was saved, but the invite could not be completed — try again later or use Forgot password after creating their Auth user.',
      }
    }
    return { ok: false, error: String(msg) }
  }

  const authUser = signupJson.user || signupJson
  const userId = authUser?.id as string | undefined
  if (!userId) {
    return { ok: false, error: 'Auth did not return a user id for the invite.' }
  }

  const { error: profileErr } = await supabase.from('users').upsert(
    {
      id: userId,
      institution_id: opts.institutionId,
      member_id: opts.memberId,
      email,
      password_hash: 'supabase_auth',
      first_name: opts.firstName,
      last_name: opts.lastName,
      phone: opts.phone || null,
      role: 'member',
      is_active: true,
    },
    { onConflict: 'id' }
  )
  if (profileErr) {
    return {
      ok: false,
      error: `Login was created but the profile failed (${profileErr.message}).`,
    }
  }

  const redirectTo = resetPasswordRedirect()
  const recoverRes = await fetch(
    `${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    }
  )
  if (!recoverRes.ok) {
    return {
      ok: false,
      error:
        'Member login was created, but the invite email failed. Ask them to use Forgot password on the login page.',
    }
  }

  return { ok: true }
}
