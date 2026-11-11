import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient'

export const habitApi = {
  list: (params = {}) => apiGet('/habits', { params }),
  get: (habitId) => apiGet(`/habits/${habitId}`),
  create: (payload) => apiPost('/habits', payload),
  update: (habitId, payload) => apiPatch(`/habits/${habitId}`, payload),
  remove: (habitId) => apiDelete(`/habits/${habitId}`),
  archive: (habitId) => apiPatch(`/habits/${habitId}/archive`),
  restore: (habitId) => apiPatch(`/habits/${habitId}/restore`),

  // Check-ins (nested under habit)
  listCheckins: (habitId, params = {}) =>
    apiGet(`/habits/${habitId}/checkins`, { params }),
  getCheckinByDate: (habitId, date) =>
    apiGet(`/habits/${habitId}/checkins/${date}`),
  createCheckin: (habitId, payload) =>
    apiPost(`/habits/${habitId}/checkins`, payload),
  updateCheckin: (habitId, checkinId, payload) =>
    apiPatch(`/habits/${habitId}/checkins/${checkinId}`, payload),
  deleteCheckin: (habitId, checkinId) =>
    apiDelete(`/habits/${habitId}/checkins/${checkinId}`),
}

export default habitApi
