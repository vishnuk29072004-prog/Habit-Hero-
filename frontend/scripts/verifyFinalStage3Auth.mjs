/**
 * Final Phase Stage 3 – complementary auth validation (live API).
 * Does not print passwords or tokens.
 * Run: node scripts/verifyFinalStage3Auth.mjs
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
const stamp = Date.now()
const passwordOk = 'SecurePassword123!'
let passed = 0
let failed = 0

function ok(l) {
  passed += 1
  console.log(`  PASS  ${l}`)
}
function fail(l, e) {
  failed += 1
  const msg =
    e?.response?.data?.message ||
    e?.response?.data?.detail ||
    e?.message ||
    e
  // Never echo tokens/passwords if somehow present
  const safe = String(msg)
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(passwordOk, '[REDACTED]')
  console.error(`  FAIL  ${l}: ${safe}`)
}

function hasTokenShape(value) {
  return typeof value === 'string' && value.length > 20
}

async function main() {
  console.log(`API base: ${BASE}\n`)

  // Invalid email
  try {
    const res = await axios.post(
      `${BASE}/auth/register`,
      {
        full_name: 'Bad Email',
        email: 'not-an-email',
        password: passwordOk,
      },
      { validateStatus: () => true }
    )
    if (res.status === 422 || res.status === 400) ok('Invalid email rejected')
    else fail('Invalid email', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Invalid email', e)
  }

  // Weak password
  try {
    const res = await axios.post(
      `${BASE}/auth/register`,
      {
        full_name: 'Weak',
        email: `stage3_weak_${stamp}@example.com`,
        password: 'weak',
      },
      { validateStatus: () => true }
    )
    if (res.status === 422 || res.status === 400) ok('Weak password rejected')
    else fail('Weak password', new Error(`status ${res.status}`))
  } catch (e) {
    fail('Weak password', e)
  }

  // User A register + login
  const emailA = `stage3_a_${stamp}@example.com`
  const emailB = `stage3_b_${stamp}@example.com`
  let accessA
  let refreshA
  let userAId

  try {
    const reg = await axios.post(`${BASE}/auth/register`, {
      full_name: 'Stage3 User A',
      email: emailA,
      password: passwordOk,
    })
    if (reg.status === 201) ok('User A registration')
    else fail('User A registration', new Error(`status ${reg.status}`))

    const login = await axios.post(`${BASE}/auth/login`, {
      email: emailA,
      password: passwordOk,
    })
    accessA = login.data?.data?.access_token
    refreshA = login.data?.data?.refresh_token
    userAId = login.data?.data?.user?.id
    if (hasTokenShape(accessA) && hasTokenShape(refreshA) && userAId) {
      ok('User A login + JWT access/refresh issued')
    } else fail('User A login', new Error('missing token pair or user id'))
  } catch (e) {
    fail('User A setup', e)
    process.exit(1)
  }

  // Access token accepted
  try {
    const me = await axios.get(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessA}` },
    })
    if (me.data?.data?.email === emailA && me.data?.data?.id === userAId) {
      ok('JWT access token accepted for /auth/me')
    } else fail('access token me', new Error('identity mismatch'))
  } catch (e) {
    fail('access token me', e)
  }

  // Protected route without token (FastAPI HTTPBearer often returns 403 when header absent)
  try {
    const res = await axios.get(`${BASE}/auth/me`, {
      validateStatus: () => true,
    })
    if ([401, 403].includes(res.status)) {
      ok(`Protected API without token rejected (${res.status})`)
    } else fail('unauth me', new Error(`status ${res.status}`))
  } catch (e) {
    fail('unauth me', e)
  }

  // Invalid email login
  try {
    const res = await axios.post(
      `${BASE}/auth/login`,
      { email: `missing_${stamp}@example.com`, password: passwordOk },
      { validateStatus: () => true }
    )
    if (res.status === 401) ok('Invalid email login → 401')
    else fail('invalid email login', new Error(`status ${res.status}`))
  } catch (e) {
    fail('invalid email login', e)
  }

  // Create habit for A (isolation probe)
  let habitAId
  try {
    const today = new Date().toISOString().slice(0, 10)
    const habit = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Stage3 Isolation Habit',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: { Authorization: `Bearer ${accessA}` } }
    )
    habitAId = habit.data?.data?.id
    if (habitAId) ok('User A owned resource created')
    else fail('habit A', new Error('no id'))
  } catch (e) {
    fail('habit A', e)
  }

  // User B
  let accessB
  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Stage3 User B',
      email: emailB,
      password: passwordOk,
    })
    const loginB = await axios.post(`${BASE}/auth/login`, {
      email: emailB,
      password: passwordOk,
    })
    accessB = loginB.data?.data?.access_token
    const meB = await axios.get(`${BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessB}` },
    })
    if (meB.data?.data?.email === emailB && meB.data?.data?.id !== userAId) {
      ok('Account switch: User B distinct identity')
    } else fail('user B identity', new Error('identity collision'))
  } catch (e) {
    fail('user B setup', e)
  }

  // Isolation: B cannot see A's habit
  try {
    const listB = await axios.get(`${BASE}/habits`, {
      headers: { Authorization: `Bearer ${accessB}` },
      params: { status: 'all', page_size: 50 },
    })
    const items = listB.data?.data?.items || []
    if (!items.some((h) => h.id === habitAId)) {
      ok('Session isolation: User B cannot see User A habit')
    } else fail('isolation', new Error('cross-user habit visible'))
  } catch (e) {
    fail('isolation', e)
  }

  // B cannot GET A's habit by id
  try {
    const res = await axios.get(`${BASE}/habits/${habitAId}`, {
      headers: { Authorization: `Bearer ${accessB}` },
      validateStatus: () => true,
    })
    if ([403, 404].includes(res.status)) {
      ok('Cross-user habit id access blocked')
    } else fail('cross-user get', new Error(`status ${res.status}`))
  } catch (e) {
    fail('cross-user get', e)
  }

  // Refresh handling + rotation
  let refresh2
  try {
    const refreshed = await axios.post(`${BASE}/auth/refresh`, {
      refresh_token: refreshA,
    })
    const nextAccess = refreshed.data?.data?.access_token
    refresh2 = refreshed.data?.data?.refresh_token
    if (hasTokenShape(nextAccess) && hasTokenShape(refresh2) && refresh2 !== refreshA) {
      ok('Refresh token rotation')
    } else fail('refresh rotation', new Error('rotation incomplete'))

    const reuse = await axios.post(
      `${BASE}/auth/refresh`,
      { refresh_token: refreshA },
      { validateStatus: () => true }
    )
    if (reuse.status === 401) ok('Failed/reused refresh rejected')
    else fail('reuse refresh', new Error(`status ${reuse.status}`))
  } catch (e) {
    fail('refresh flow', e)
  }

  // Garbage refresh (failed refresh)
  try {
    const res = await axios.post(
      `${BASE}/auth/refresh`,
      { refresh_token: 'not-a-valid-refresh-token' },
      { validateStatus: () => true }
    )
    if (res.status === 401) ok('Invalid refresh token → 401')
    else fail('invalid refresh', new Error(`status ${res.status}`))
  } catch (e) {
    fail('invalid refresh', e)
  }

  // Logout A
  try {
    const out = await axios.post(`${BASE}/auth/logout`, {
      refresh_token: refresh2,
    })
    if (out.data?.success) ok('Logout succeeds')
    else fail('logout', new Error('success false'))

    const after = await axios.post(
      `${BASE}/auth/refresh`,
      { refresh_token: refresh2 },
      { validateStatus: () => true }
    )
    if (after.status === 401) ok('Refresh after logout rejected')
    else fail('post-logout refresh', new Error(`status ${after.status}`))
  } catch (e) {
    fail('logout flow', e)
  }

  // Error messages should not include password_hash or raw password
  try {
    const res = await axios.post(
      `${BASE}/auth/login`,
      { email: emailA, password: 'WrongPassword1!' },
      { validateStatus: () => true }
    )
    const blob = JSON.stringify(res.data || {})
    if (
      !blob.includes('password_hash') &&
      !blob.includes(passwordOk) &&
      !blob.toLowerCase().includes('bcrypt')
    ) {
      ok('Auth error payloads omit password/hash secrets')
    } else fail('error leak', new Error('sensitive data in error body'))
  } catch (e) {
    fail('error leak', e)
  }

  // A still cannot use expired-style bad JWT
  try {
    const res = await axios.get(`${BASE}/auth/me`, {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.bad' },
      validateStatus: () => true,
    })
    if (res.status === 401) ok('Malformed/invalid JWT rejected')
    else fail('bad jwt', new Error(`status ${res.status}`))
  } catch (e) {
    fail('bad jwt', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
