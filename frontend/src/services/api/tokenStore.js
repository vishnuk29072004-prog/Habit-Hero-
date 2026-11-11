/**
 * Runtime JWT holder for apiClient.
 *
 * Source of truth while the app is running: in-memory tokens.
 * Optional tab-scoped sessionStorage hydrate (NOT localStorage) so a page
 * reload in the same tab can restore the session. Passwords are never stored.
 */

const SESSION_KEY = 'habit-hero-auth-session'

let accessToken = null
let refreshToken = null
let onTokensCleared = null

function canUseSessionStorage() {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

function persistSession() {
  if (!canUseSessionStorage()) return
  if (!accessToken || !refreshToken) {
    sessionStorage.removeItem(SESSION_KEY)
    return
  }
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
  )
}

/** Load tokens from sessionStorage into memory (boot). */
export function hydrateTokensFromSession() {
  if (!canUseSessionStorage()) return false
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    if (!parsed?.access_token || !parsed?.refresh_token) {
      sessionStorage.removeItem(SESSION_KEY)
      return false
    }
    accessToken = parsed.access_token
    refreshToken = parsed.refresh_token
    return true
  } catch {
    sessionStorage.removeItem(SESSION_KEY)
    return false
  }
}

export function getAccessToken() {
  return accessToken
}

export function getRefreshToken() {
  return refreshToken
}

export function setTokens({ accessToken: access, refreshToken: refresh } = {}) {
  accessToken = access || null
  refreshToken = refresh || null
  persistSession()
}

export function clearTokens() {
  accessToken = null
  refreshToken = null
  if (canUseSessionStorage()) {
    sessionStorage.removeItem(SESSION_KEY)
  }
  if (typeof onTokensCleared === 'function') {
    try {
      onTokensCleared()
    } catch {
      // Ignore listener errors — callers own UI logout.
    }
  }
}

/** Optional callback when refresh fails and tokens are cleared (AuthContext). */
export function setOnTokensCleared(callback) {
  onTokensCleared = typeof callback === 'function' ? callback : null
}

export default {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  setOnTokensCleared,
  hydrateTokensFromSession,
}
