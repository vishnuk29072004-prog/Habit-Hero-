import { apiGetBlob } from './apiClient'

function assertDateKey(value, label) {
  const cleaned = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    throw new Error(`${label} must be YYYY-MM-DD`)
  }
  return cleaned
}

export function toProgressPdfParams({ startDate, endDate } = {}) {
  const start_date = assertDateKey(startDate, 'Start date')
  const end_date = assertDateKey(endDate, 'End date')
  if (end_date < start_date) {
    throw new Error('End date must not precede start date')
  }
  return { start_date, end_date }
}

export const reportApi = {
  downloadProgressPdf: async ({ startDate, endDate } = {}) => {
    const params = toProgressPdfParams({ startDate, endDate })
    return apiGetBlob('/reports/progress/pdf', { params })
  },
}

export default reportApi
