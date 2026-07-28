/** Site paths that work under /dashboard/ (local) and /SaccoFlow/dashboard/ (GitHub Pages). */

/** e.g. BASE_URL `/SaccoFlow/dashboard/` → `/SaccoFlow/` */
export function siteRoot(): string {
  return import.meta.env.BASE_URL.replace(/\/dashboard\/?$/, '/') || '/'
}

export function loginPageUrl(): string {
  return `${siteRoot()}login.html`
}

export function resetPasswordUrl(): string {
  // Absolute URL for Supabase email redirects
  if (typeof window === 'undefined') return '/dashboard/reset-password'
  return `${window.location.origin}${import.meta.env.BASE_URL}reset-password`.replace(
    /([^:]\/)\/+/g,
    '$1'
  )
}
