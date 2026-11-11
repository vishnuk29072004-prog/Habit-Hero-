import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient'

export const goalApi = {
  list: (params = {}) => apiGet('/goals', { params }),
  summary: () => apiGet('/goals/summary'),
  get: (goalId) => apiGet(`/goals/${goalId}`),
  create: (payload) => apiPost('/goals', payload),
  update: (goalId, payload) => apiPatch(`/goals/${goalId}`, payload),
  remove: (goalId) => apiDelete(`/goals/${goalId}`),
}

export default goalApi
