import { apiDelete, apiGet, apiPost } from './apiClient'

export const googleCalendarApi = {
  status: () => apiGet('/calendar/google/status'),
  connect: () => apiGet('/calendar/google/connect'),
  disconnect: () => apiPost('/calendar/google/disconnect'),
  sync: () => apiPost('/calendar/google/sync'),
  listEvents: () => apiGet('/calendar/google/events'),
  deleteEvent: (eventId) => apiDelete(`/calendar/google/events/${eventId}`),
}

export default googleCalendarApi
