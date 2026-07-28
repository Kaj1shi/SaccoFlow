import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in dashboard/.env')
}

const projectRef = new URL(url).hostname.split('.')[0]
const TAB_ID_KEY = 'saccoflow-tab-id'

/**
 * Stable id for THIS browser tab only (lives in sessionStorage).
 * Used so each tab gets its own Supabase auth storage key AND its own
 * BroadcastChannel — without that, supabase-js syncs sign-in/sign-out
 * across every open tab of the same site.
 */
function getTabId(): string {
  try {
    let id = window.sessionStorage.getItem(TAB_ID_KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(TAB_ID_KEY, id)
    }
    return id
  } catch {
    return 'fallback'
  }
}

export const authStorageKey = `sb-${projectRef}-auth-token-${getTabId()}`

// Clear leftover sessions from earlier (shared) storage schemes.
try {
  window.localStorage.removeItem(`sb-${projectRef}-auth-token`)
  window.sessionStorage.removeItem(`sb-${projectRef}-auth-token`)
} catch {
  // storage unavailable
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: window.sessionStorage,
    storageKey: authStorageKey,
  },
})
