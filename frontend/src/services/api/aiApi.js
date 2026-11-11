import { apiPost } from './apiClient'

export const aiApi = {
  habitSuggestions: (payload = {}) =>
    apiPost('/ai/habit-suggestions', payload),
  moodAnalysis: (payload) =>
    apiPost('/ai/mood-analysis', payload),
}

export default aiApi
