import { apiDelete, apiGet, apiPatch, apiPostForm } from './apiClient'

export const userApi = {
  getProfile: () => apiGet('/users/me'),
  updateProfile: (payload) => apiPatch('/users/me', payload),
  changePassword: (payload) => apiPatch('/users/me/password', payload),
  getSettings: () => apiGet('/users/me/settings'),
  updateSettings: (payload) => apiPatch('/users/me/settings', payload),

  uploadAvatar: (file) => {
    const form = new FormData()
    form.append('file', file)
    return apiPostForm('/users/me/avatar', form)
  },

  deleteAvatar: () => apiDelete('/users/me/avatar'),
}

export default userApi
