import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient'

export const notificationApi = {
  list: (params = {}) => apiGet('/notifications', { params }),
  summary: (params = {}) => apiGet('/notifications/summary', { params }),
  get: (notificationId) => apiGet(`/notifications/${notificationId}`),
  generate: () => apiPost('/notifications/generate'),
  markRead: (notificationId) =>
    apiPatch(`/notifications/${notificationId}/read`),
  markAllRead: () => apiPost('/notifications/read-all'),
  remove: (notificationId) => apiDelete(`/notifications/${notificationId}`),
}

export default notificationApi
