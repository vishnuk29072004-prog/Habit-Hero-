/**
 * Step C auth smoke tests against a live FastAPI backend.
 * Run: node scripts/verifyAuthIntegration.mjs
 */

import axios from 'axios'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadBase() {
  for (const name of ['.env', '.env.example']) {
    const path = resolve(root, name)
    if (!existsSync(path)) continue
    const m = readFileSync(path, 'utf8').match(/^VITE_API_BASE_URL\s*=\s*(.+)$/m)
    if (m) return m[1].trim().replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:8000/api/v1'
}

const BASE = loadBase()
const email = `stepc_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0

function ok(l) {
  passed += 1
  console.log(`  PASS  ${l}`)
}
function fail(l, e) {
  failed += 1
  console.error(`  FAIL  ${l}: ${e?.message || e}`)
}

async function main() {
  console.log(`API base: ${BASE}`)
  console.log(`Test user: ${email}\n`)

  let access
  let refresh

  // Register
  try {
    const res = await axios.post(`${BASE}/auth/register`, {
      full_name: 'Step C User',
      email,
      password,
    })
    if (res.status === 201 && res.data?.data?.email === email) ok('Register')
    else fail('Register', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('Register', e)
  }

  // Duplicate email
  try {
    const res = await axios.post(
      `${BASE}/auth/register`,
      { full_name: 'Dup', email, password },
      { validateStatus: () => true }
    )
    if (res.status === 409) ok('Duplicate email → 409')
    else fail('Duplicate email', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Duplicate email', e)
  }

  // Invalid login
  try {
    const res = await axios.post(
      `${BASE}/auth/login`,
      { email, password: 'WrongPassword1!' },
      { validateStatus: () => true }
    )
    if (res.status === 401) ok('Invalid credentials → 401')
    else fail('Invalid credentials', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Invalid credentials', e)
  }

  // Login
  try {
    const res = await axios.post(`${BASE}/auth/login`, { email, password })
    access = res.data?.data?.access_token
    refresh = res.data?.data?.refresh_token
    if (access && refresh && res.data.data.user?.full_name) ok('Login token pair')
    else fail('Login', new Error('missing tokens'))
  } catch (e) {
    fail('Login', e)
  }

  // Me
  try {
    const res = await axios.get(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
    })
    if (res.data?.data?.email === email) ok('GET /auth/me')
    else fail('GET /auth/me', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET /auth/me', e)
  }

  // Refresh rotation
  let access2
  let refresh2
  try {
    const res = await axios.post(`${BASE}/auth/refresh`, {
      refresh_token: refresh,
    })
    access2 = res.data?.data?.access_token
    refresh2 = res.data?.data?.refresh_token
    if (access2 && refresh2 && refresh2 !== refresh) ok('Refresh rotates tokens')
    else if (access2 && refresh2) ok('Refresh returns token pair')
    else fail('Refresh', new Error('missing tokens'))
  } catch (e) {
    fail('Refresh', e)
  }

  // Old refresh should fail after rotation
  try {
    const res = await axios.post(
      `${BASE}/auth/refresh`,
      { refresh_token: refresh },
      { validateStatus: () => true }
    )
    if (res.status === 401) ok('Old refresh token rejected')
    else fail('Old refresh rejected', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Old refresh rejected', e)
  }

  // Concurrent 401 handling is client-side; smoke two parallel /me with bad token
  try {
    const bad = await Promise.all([
      axios.get(`${BASE}/auth/me`, {
        headers: { Authorization: 'Bearer bad' },
        validateStatus: () => true,
      }),
      axios.get(`${BASE}/auth/me`, {
        headers: { Authorization: 'Bearer bad' },
        validateStatus: () => true,
      }),
    ])
    if (bad.every((r) => r.status === 401)) ok('Concurrent invalid access → 401')
    else fail('Concurrent 401', new Error(bad.map((r) => r.status).join(',')))
  } catch (e) {
    fail('Concurrent 401', e)
  }

  // Logout
  try {
    const res = await axios.post(`${BASE}/auth/logout`, {
      refresh_token: refresh2,
    })
    if (res.data?.success) ok('Logout')
    else fail('Logout', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('Logout', e)
  }

  // Refresh after logout
  try {
    const res = await axios.post(
      `${BASE}/auth/refresh`,
      { refresh_token: refresh2 },
      { validateStatus: () => true }
    )
    if (res.status === 401) ok('Refresh after logout → 401')
    else fail('Refresh after logout', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Refresh after logout', e)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main()
