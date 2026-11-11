import { apiGet } from './apiClient'

export const achievementApi = {
  list: () => apiGet('/achievements'),
  summary: () => apiGet('/achievements/summary'),
  get: (achievementId) => apiGet(`/achievements/${achievementId}`),
}

export default achievementApi
