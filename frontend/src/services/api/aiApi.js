import { apiPost } from './apiClient'

/**
 * Gemini habit/journal calls often need 60–90s on the backend
 * (GEMINI_TIMEOUT_SECONDS default 90). The shared Axios client defaults
 * to 15s, which aborts before the API can respond.
 */
const AI_REQUEST_TIMEOUT_MS = 120000

export const aiApi = {
  habitSuggestions: (payload = {}) =>
    apiPost('/ai/habit-suggestions', payload, {
      timeout: AI_REQUEST_TIMEOUT_MS,
    }),
  moodAnalysis: (payload) =>
    apiPost('/ai/mood-analysis', payload, {
      timeout: AI_REQUEST_TIMEOUT_MS,
    }),
}

export default aiApi
