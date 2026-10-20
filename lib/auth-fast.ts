/**
 * Fast sign-out: clears the local session synchronously and navigates immediately.
 * The server-side token revocation is fired in the background (keepalive) and never blocks the UI.
 */
import { createClient } from '@/lib/supabase/client'

export async function fastSignOut(redirectTo = '/') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  let accessToken: string | null = null

  try {
    // getSession() reads local storage/cookies only (no network round trip)
    const { data } = await createClient().auth.getSession()
    accessToken = data.session?.access_token ?? null
  } catch {}

  // Background revoke (scope=local only revokes this device's refresh token)
  if (accessToken && url && anon) {
    try {
      void fetch(`${url}/auth/v1/logout?scope=local`, {
        method: 'POST',
        keepalive: true,
        headers: { Authorization: `Bearer ${accessToken}`, apikey: anon },
      }).catch(() => {})
    } catch {}
  }

  // Clear local session state right away
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('sb-') || key.includes('supabase')) localStorage.removeItem(key)
    }
  } catch {}
  try {
    for (const part of document.cookie.split(';')) {
      const name = part.split('=')[0]?.trim()
      if (name && name.startsWith('sb-')) {
        document.cookie = `${name}=; Max-Age=0; path=/`
      }
    }
  } catch {}

  window.location.assign(redirectTo)
}
