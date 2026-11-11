import { apiGet, apiPost } from './apiClient'

/** Auth endpoints — ready for Step C; not wired to AuthContext yet. */
export const authApi = {
  register: (payload) => apiPost('/auth/register', payload),
  login: (payload) => apiPost('/auth/login', payload),
  refresh: (refreshToken) =>
    apiPost('/auth/refresh', { refresh_token: refreshToken }),
  logout: (refreshToken) =>
    apiPost('/auth/logout', { refresh_token: refreshToken }),
  me: () => apiGet('/auth/me'),
}

export default authApi
