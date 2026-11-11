/**
 * Normalized API error for consistent UI handling.
 */
export class ApiError extends Error {
  constructor({
    message = 'Request failed',
    status = null,
    detail = null,
    data = null,
    code = null,
    cause = null,
  } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.data = data
    this.code = code
    this.cause = cause
  }
}

export function isApiError(error) {
  return error instanceof ApiError
}

export function toApiError(error) {
  if (error instanceof ApiError) return error

  if (error?.isAxiosError) {
    if (!error.response) {
      const aborted = error.code === 'ECONNABORTED'
      const url = String(error.config?.url || '')
      const isAiRoute = url.includes('/ai/')
      return new ApiError({
        message: aborted
          ? isAiRoute
            ? 'The AI request took too long. Gemini can need up to about 90 seconds — please try again.'
            : 'Request timed out. Please try again.'
          : 'Unable to reach the server. Check your connection.',
        status: null,
        code: error.code || 'NETWORK_ERROR',
        cause: error,
      })
    }

    const payload = error.response.data
    // Blob error bodies (e.g. PDF download with responseType: 'blob') are not JSON objects.
    const blobError =
      typeof Blob !== 'undefined' && payload instanceof Blob
        ? 'Unable to complete the download. Please try again.'
        : null
    const status = error.response.status
    const rawDetail = payload?.detail
    const detailText =
      typeof rawDetail === 'string'
        ? rawDetail
        : Array.isArray(rawDetail)
          ? rawDetail
              .map((item) =>
                typeof item === 'string'
                  ? item
                  : item?.msg || item?.message || ''
              )
              .filter(Boolean)
              .join(' ')
          : null

    let message =
      blobError ||
      (typeof payload?.message === 'string' && payload.message) ||
      detailText ||
      error.message ||
      'Request failed'

    // Prefer explicit backend detail; refine generic labels by status.
    if (status === 429) {
      message =
        detailText ||
        'AI rate limit reached. Please wait a moment and try again.'
    } else if (
      status === 503 &&
      typeof detailText === 'string' &&
      detailText.toLowerCase().includes('google calendar')
    ) {
      message = detailText
    } else if (
      status === 503 &&
      typeof detailText === 'string' &&
      (detailText.toLowerCase().includes('overloaded') ||
        detailText.toLowerCase().includes('high demand'))
    ) {
      message = detailText
    } else if (status === 504) {
      message =
        detailText ||
        'The AI request timed out waiting for Google Gemini. Please try again.'
    }

    return new ApiError({
      message,
      status,
      detail: rawDetail ?? null,
      data: payload ?? null,
      code: `HTTP_${status}`,
      cause: error,
    })
  }

  return new ApiError({
    message: error?.message || 'Unexpected error',
    cause: error,
    code: 'UNKNOWN',
  })
}

export default ApiError
