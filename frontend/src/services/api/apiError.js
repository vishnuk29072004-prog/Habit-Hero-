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
      return new ApiError({
        message:
          error.code === 'ECONNABORTED'
            ? 'Request timed out. Please try again.'
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
    const message =
      blobError ||
      (typeof payload?.message === 'string' && payload.message) ||
      (typeof payload?.detail === 'string' && payload.detail) ||
      error.message ||
      'Request failed'

    return new ApiError({
      message,
      status: error.response.status,
      detail: payload?.detail ?? null,
      data: payload ?? null,
      code: `HTTP_${error.response.status}`,
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
