import { getApiBaseUrl } from './api/apiClient'

/** Resolve backend avatar/media paths (e.g. `/uploads/...`) to an absolute URL. */
export function resolveMediaUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const apiBase = getApiBaseUrl()
  const origin = apiBase.replace(/\/api\/v1\/?$/i, '')
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${origin}${normalized}`
}

export default resolveMediaUrl
