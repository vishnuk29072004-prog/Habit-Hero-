import { apiGet } from './apiClient'

export const analyticsApi = {
  overview: (params = {}) => apiGet('/analytics/overview', { params }),
  habit: (habitId, params = {}) =>
    apiGet(`/analytics/habits/${habitId}`, { params }),
  weekly: (params = {}) => apiGet('/analytics/weekly', { params }),
  monthly: (params = {}) => apiGet('/analytics/monthly', { params }),
  categories: (params = {}) => apiGet('/analytics/categories', { params }),
  bestDays: (params = {}) => apiGet('/analytics/best-days', { params }),
  streaks: (params = {}) => apiGet('/analytics/streaks', { params }),
}

export default analyticsApi
