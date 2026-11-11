import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient'

export const journalApi = {
  list: (params = {}) => apiGet('/journal', { params }),
  summary: (params = {}) => apiGet('/journal/summary', { params }),
  get: (entryId) => apiGet(`/journal/${entryId}`),
  create: (payload) => apiPost('/journal', payload),
  update: (entryId, payload) => apiPatch(`/journal/${entryId}`, payload),
  remove: (entryId) => apiDelete(`/journal/${entryId}`),
}

export default journalApi
