/**
 * Centralized Axios client for Habit Hero FastAPI (`/api/v1`).
 *
 * - Base URL from `VITE_API_BASE_URL`
 * - Bearer access token via tokenStore
 * - Single-flight refresh using POST /auth/refresh (prepared for Step C)
 * - JSON + multipart helpers
 */

import axios from 'axios'
import { ApiError, toApiError } from './apiError'
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from './tokenStore'

const DEFAULT_BASE_URL = 'http://127.0.0.1:8000/api/v1'

export function getApiBaseUrl() {
  const fromEnv = import.meta.env.VITE_API_BASE_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/+$/, '')
  }
  return DEFAULT_BASE_URL
}

const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }

  // Let the browser set multipart boundaries.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers) {
      delete config.headers['Content-Type']
    }
  } else if (config.data != null && !config.headers?.['Content-Type']) {
    config.headers = config.headers || {}
    config.headers['Content-Type'] = 'application/json'
  }

  return config
})

let refreshPromise = null

async function refreshAccessToken() {
  const refresh = getRefreshToken()
  if (!refresh) {
    clearTokens()
    throw new ApiError({
      message: 'Session expired. Please sign in again.',
      status: 401,
      code: 'NO_REFRESH_TOKEN',
    })
  }

  // Bare axios call avoids interceptor recursion / infinite refresh loops.
  let response
  try {
    response = await axios.post(
      `${getApiBaseUrl()}/auth/refresh`,
      { refresh_token: refresh },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    )
  } catch (error) {
    clearTokens()
    throw toApiError(error)
  }

  const pair = response.data?.data
  if (!pair?.access_token || !pair?.refresh_token) {
    clearTokens()
    throw new ApiError({
      message: 'Invalid refresh response from server.',
      status: 401,
      code: 'INVALID_REFRESH_RESPONSE',
      data: response.data,
    })
  }

  setTokens({
    accessToken: pair.access_token,
    refreshToken: pair.refresh_token,
  })
  return pair.access_token
}

function enqueueRefresh() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .catch((error) => {
        clearTokens()
        throw toApiError(error)
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status

    const isRefreshCall =
      typeof original?.url === 'string' &&
      original.url.includes('/auth/refresh')

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !isRefreshCall &&
      getRefreshToken()
    ) {
      original._retry = true
      try {
        const access = await enqueueRefresh()
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${access}`
        return apiClient.request(original)
      } catch (refreshError) {
        throw toApiError(refreshError)
      }
    }

    throw toApiError(error)
  }
)

function unwrap(response) {
  return response.data
}

export async function apiGet(path, config = {}) {
  return unwrap(await apiClient.get(path, config))
}

export async function apiPost(path, data, config = {}) {
  return unwrap(await apiClient.post(path, data, config))
}

export async function apiPatch(path, data, config = {}) {
  return unwrap(await apiClient.patch(path, data, config))
}

export async function apiPut(path, data, config = {}) {
  return unwrap(await apiClient.put(path, data, config))
}

export async function apiDelete(path, config = {}) {
  return unwrap(await apiClient.delete(path, config))
}

/** Multipart POST (e.g. avatar upload). Do not set Content-Type manually. */
export async function apiPostForm(path, formData, config = {}) {
  return unwrap(
    await apiClient.post(path, formData, {
      ...config,
      headers: {
        ...(config.headers || {}),
      },
    })
  )
}

export { apiClient }
export default apiClient
