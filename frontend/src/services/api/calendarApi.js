import { apiDelete, apiGet, apiPatch, apiPost } from './apiClient'

export const calendarApi = {
  monthly: (params = {}) => apiGet('/calendar/monthly', { params }),
  daily: (params = {}) => apiGet('/calendar/daily', { params }),
  summary: (params = {}) => apiGet('/calendar/summary', { params }),

  listNotes: (params = {}) => apiGet('/calendar/notes', { params }),
  createNote: (payload) => apiPost('/calendar/notes', payload),
  updateNote: (noteId, payload) =>
    apiPatch(`/calendar/notes/${noteId}`, payload),
  deleteNote: (noteId) => apiDelete(`/calendar/notes/${noteId}`),
}

export default calendarApi
