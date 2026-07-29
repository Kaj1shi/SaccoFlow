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

function authErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const b = body as Record<string, unknown>
  const msg = b.msg || b.message || b.error_description || b.error
  return msg ? String(msg) : fallback
}

function isRateLimit(msg: string): boolean {
  return /rate limit|too many|over_email/i.test(msg)
}

/**
 * Send (or re-send) the password-setup email only.
 * Prefer this when the Auth user already exists — uses one email slot.
 */
export async function sendMemberInviteEmail(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const redirectTo = resetPasswordRedirect()

  const recoverRes = await fetch(
    `${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
    {
      method: 'POST',
      headers: {
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    }
  )
  const recoverJson = await recoverRes.json().catch(() => ({}))
  if (!recoverRes.ok) {
    const msg = authErrorMessage(recoverJson, 'Invite email failed.')
    if (isRateLimit(msg)) {
      return {
        ok: false,
        error:
          'Supabase email rate limit hit (built-in mailer allows only ~2 emails per hour). Wait about an hour, or set up custom SMTP under Authentication → Emails. Meanwhile they can try Forgot password on the login page.',
      }
    }
    return {
      ok: false,
      error: `${msg} Ask them to use Forgot password on the login page, or check that the reset URL is allowlisted in Supabase Auth → URL Configuration.`,
    }
  }

  return { ok: true }
}

/**
 * Create Auth user + users profile for a member without replacing the admin session.
 * Uses raw Auth HTTP APIs (not supabase.auth.signUp) so the staff session stays put,
 * then sends a recovery email so the member sets their own password.
 *
 * Tip: turn OFF "Confirm email" in Supabase Auth → Providers → Email so signup does not
 * burn an email slot; only the password invite is sent (critical on the free mailer).
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
    const msg = authErrorMessage(signupJson, 'Could not create the member login.')
    if (/already|registered|exists/i.test(String(msg))) {
      // Login already exists — just (re)send the password email.
      return sendMemberInviteEmail(email)
    }
    if (isRateLimit(String(msg))) {
      return {
        ok: false,
        error:
          'Email rate limit reached while creating the login. Member was saved — wait ~1 hour then use Resend invite, or turn off Confirm email / add custom SMTP in Supabase.',
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

  // If Confirm email is ON, signup already consumed an email slot. Still send recover
  // so they can set a password — but warn clearly when the free mailer rate-limits.
  const inviteMail = await sendMemberInviteEmail(email)
  if (!inviteMail.ok) {
    const confirmationSent = Boolean(authUser?.confirmation_sent_at)
    return {
      ok: false,
      error: confirmationSent
        ? `${inviteMail.error} A confirmation email may already be in their inbox or spam — after confirming, use Forgot password on the login page.`
        : inviteMail.error,
    }
  }

  return { ok: true }
}

/** Re-send invite for an existing member row (creates Auth user if missing). */
export async function resendMemberPortalInvite(opts: {
  memberId: string
  institutionId: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = opts.email.trim().toLowerCase()
  if (!email) return { ok: false, error: 'This member has no email on file.' }

  const { data: linked } = await supabase
    .from('users')
    .select('id')
    .eq('member_id', opts.memberId)
    .maybeSingle()

  if (linked?.id) {
    return sendMemberInviteEmail(email)
  }

  return inviteMemberPortal(opts)
}
