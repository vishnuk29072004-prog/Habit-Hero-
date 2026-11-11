/**
 * Step B smoke tests for the API client (Node + axios).
 * Run: node scripts/verifyApiClient.mjs
 *
 * Does not import Vite modules; mirrors client behavior against a live API.
 */

import axios from 'axios'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvBaseUrl() {
  for (const name of ['.env', '.env.example']) {
    const path = resolve(root, name)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    const match = text.match(/^VITE_API_BASE_URL\s*=\s*(.+)$/m)
    if (match) return match[1].trim().replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:8000/api/v1'
}

const BASE = loadEnvBaseUrl()
let passed = 0
let failed = 0

function ok(label) {
  passed += 1
  console.log(`  PASS  ${label}`)
}

function fail(label, err) {
  failed += 1
  console.error(`  FAIL  ${label}`)
  console.error(`        ${err?.message || err}`)
}

async function main() {
  console.log(`API base: ${BASE}\n`)

  if (!BASE.endsWith('/api/v1')) {
    fail('Base URL ends with /api/v1', new Error(`Got ${BASE}`))
  } else {
    ok('Base URL ends with /api/v1')
  }

  // Health (no auth)
  try {
    const health = await axios.get(`${BASE}/health`, { timeout: 5000 })
    if (health.status !== 200) throw new Error(`status ${health.status}`)
    ok('GET /health (JSON)')
  } catch (e) {
    fail('GET /health (JSON)', e)
  }

  // Missing auth → 401/403
  try {
    await axios.get(`${BASE}/habits`, { timeout: 5000 })
    fail('GET /habits without token should fail', new Error('unexpected 2xx'))
  } catch (e) {
    const status = e.response?.status
    if (status === 401 || status === 403) ok(`GET /habits unauthorized (${status})`)
    else fail('GET /habits unauthorized', e)
  }

  // Invalid JSON body → validation or auth error (still structured)
  try {
    await axios.post(
      `${BASE}/auth/login`,
      { email: 'not-an-email', password: '' },
      { timeout: 5000, validateStatus: () => true }
    ).then((res) => {
      if (res.status === 422 || res.status === 401) {
        ok(`POST /auth/login invalid payload → ${res.status}`)
        if (res.data && typeof res.data === 'object') {
          ok('Error response is JSON object')
        } else {
          fail('Error response JSON', new Error(typeof res.data))
        }
      } else {
        fail('POST /auth/login invalid payload', new Error(`status ${res.status}`))
      }
    })
  } catch (e) {
    fail('POST /auth/login invalid payload', e)
  }

  // Network error (closed port)
  try {
    await axios.get('http://127.0.0.1:59999/api/v1/health', { timeout: 1500 })
    fail('Network error expected', new Error('unexpected success'))
  } catch (e) {
    if (!e.response) ok('Network/unreachable host yields no response')
    else fail('Network error expected', e)
  }

  // Multipart shape (auth required — expect 401/403, proves FormData accepted by client stack)
  try {
    const form = new FormData()
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'x.png')
    const res = await axios.post(`${BASE}/users/me/avatar`, form, {
      timeout: 5000,
      validateStatus: () => true,
    })
    if (res.status === 401 || res.status === 403) {
      ok(`POST multipart /users/me/avatar unauthorized (${res.status})`)
    } else if (res.status === 422 || res.status === 400) {
      ok(`POST multipart reached server (${res.status})`)
    } else {
      fail('POST multipart avatar', new Error(`status ${res.status}`))
    }
  } catch (e) {
    fail('POST multipart avatar', e)
  }

  // Authorization header injection smoke (manual header)
  try {
    const res = await axios.get(`${BASE}/auth/me`, {
      headers: { Authorization: 'Bearer not-a-real-token' },
      timeout: 5000,
      validateStatus: () => true,
    })
    if (res.status === 401) ok('Bearer header accepted path → 401 invalid token')
    else fail('Bearer header path', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Bearer header path', e)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main()
