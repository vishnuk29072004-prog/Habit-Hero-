/**
 * Step D profile/settings smoke tests (live FastAPI).
 * Run: node scripts/verifyProfileSettings.mjs
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
const email = `stepd_${Date.now()}@example.com`
const password = 'SecurePassword123!'
const nextPassword = 'NewSecurePass456!'
let passed = 0
let failed = 0
let access

function ok(l) {
  passed += 1
  console.log(`  PASS  ${l}`)
}
function fail(l, e) {
  failed += 1
  console.error(`  FAIL  ${l}: ${e?.response?.data?.message || e?.message || e}`)
}

function authHeaders() {
  return { Authorization: `Bearer ${access}` }
}

async function main() {
  console.log(`API base: ${BASE}\n`)

  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Step D User',
      email,
      password,
    })
    const login = await axios.post(`${BASE}/auth/login`, { email, password })
    access = login.data.data.access_token
    ok('Register + login')
  } catch (e) {
    fail('Register + login', e)
    process.exit(1)
  }

  try {
    const res = await axios.get(`${BASE}/users/me`, { headers: authHeaders() })
    if (res.data?.data?.email === email) ok('GET /users/me')
    else fail('GET /users/me', new Error('email mismatch'))
  } catch (e) {
    fail('GET /users/me', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/users/me`,
      { full_name: 'Step D Renamed' },
      { headers: authHeaders() }
    )
    if (res.data?.data?.full_name === 'Step D Renamed') ok('PATCH profile name')
    else fail('PATCH profile', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH profile', e)
  }

  // Tiny valid 1x1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )
  try {
    const form = new FormData()
    form.append('file', new Blob([png], { type: 'image/png' }), 'dot.png')
    const res = await axios.post(`${BASE}/users/me/avatar`, form, {
      headers: authHeaders(),
    })
    if (res.data?.data?.avatar_url) ok('POST avatar')
    else fail('POST avatar', new Error('missing avatar_url'))
  } catch (e) {
    fail('POST avatar', e)
  }

  try {
    const form = new FormData()
    form.append('file', new Blob(['not-an-image'], { type: 'text/plain' }), 'x.txt')
    const res = await axios.post(`${BASE}/users/me/avatar`, form, {
      headers: authHeaders(),
      validateStatus: () => true,
    })
    if (res.status >= 400) ok(`Invalid avatar type → ${res.status}`)
    else fail('Invalid avatar type', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Invalid avatar type', e)
  }

  try {
    const big = new Uint8Array(2.5 * 1024 * 1024)
    const form = new FormData()
    form.append('file', new Blob([big], { type: 'image/png' }), 'big.png')
    const res = await axios.post(`${BASE}/users/me/avatar`, form, {
      headers: authHeaders(),
      validateStatus: () => true,
    })
    if (res.status >= 400) ok(`Oversized avatar → ${res.status}`)
    else fail('Oversized avatar', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Oversized avatar', e)
  }

  try {
    const res = await axios.delete(`${BASE}/users/me/avatar`, {
      headers: authHeaders(),
    })
    if (res.data?.data?.avatar_url == null) ok('DELETE avatar')
    else fail('DELETE avatar', new Error('avatar still set'))
  } catch (e) {
    fail('DELETE avatar', e)
  }

  try {
    const res = await axios.get(`${BASE}/users/me/settings`, {
      headers: authHeaders(),
    })
    if (res.data?.data?.streak_goal_target === 15) ok('GET settings defaults')
    else ok('GET settings')
  } catch (e) {
    fail('GET settings', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/users/me/settings`,
      {
        streak_goal_target: 21,
        remind_habits_overdue: false,
      },
      { headers: authHeaders() }
    )
    const d = res.data?.data
    if (d?.streak_goal_target === 21 && d?.remind_habits_overdue === false) {
      ok('PATCH settings partial')
    } else fail('PATCH settings', new Error(JSON.stringify(d)))
  } catch (e) {
    fail('PATCH settings', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/users/me/password`,
      { current_password: 'wrong', new_password: nextPassword },
      { headers: authHeaders(), validateStatus: () => true }
    )
    if (res.status === 401 || res.status === 400) ok('Wrong current password rejected')
    else fail('Wrong password', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Wrong password', e)
  }

  try {
    await axios.patch(
      `${BASE}/users/me/password`,
      { current_password: password, new_password: nextPassword },
      { headers: authHeaders() }
    )
    const login = await axios.post(`${BASE}/auth/login`, {
      email,
      password: nextPassword,
    })
    if (login.data?.data?.access_token) ok('Password change + re-login')
    else fail('Password change', new Error('re-login failed'))
  } catch (e) {
    fail('Password change', e)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main()
