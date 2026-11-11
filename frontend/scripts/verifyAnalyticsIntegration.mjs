/**
 * Step G dashboard/analytics smoke tests (live FastAPI).
 * Run: node scripts/verifyAnalyticsIntegration.mjs
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
const email = `stepg_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access
let habitId
const today = new Date().toISOString().slice(0, 10)
const month = Number(today.slice(5, 7))
const year = Number(today.slice(0, 4))

function ok(l) {
  passed += 1
  console.log(`  PASS  ${l}`)
}
function fail(l, e) {
  failed += 1
  console.error(
    `  FAIL  ${l}: ${e?.response?.data?.message || e?.response?.data?.detail || e?.message || e}`
  )
}
function authHeaders() {
  return { Authorization: `Bearer ${access}` }
}

async function main() {
  console.log(`API base: ${BASE}\n`)

  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Step G User',
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
    const res = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Analytics Habit',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    habitId = res.data.data.id
    await axios.post(
      `${BASE}/habits/${habitId}/checkins`,
      { date: today, status: 'completed' },
      { headers: authHeaders() }
    )
    ok('Seed habit + check-in')
  } catch (e) {
    fail('Seed habit + check-in', e)
    process.exit(1)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/overview`, {
      headers: authHeaders(),
    })
    const d = res.data.data
    if (
      typeof d.active_habits === 'number' &&
      typeof d.today_completion_percentage === 'number' &&
      typeof d.current_streak === 'number'
    ) {
      ok('GET /analytics/overview')
    } else fail('overview', new Error(JSON.stringify(d)))
  } catch (e) {
    fail('overview', e)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/habits/${habitId}`, {
      headers: authHeaders(),
      params: { start_date: today, end_date: today },
    })
    if (res.data.data.habit?.id === habitId) ok('GET /analytics/habits/{id}')
    else fail('habit analytics', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('habit analytics', e)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/weekly`, {
      headers: authHeaders(),
      params: { date: today },
    })
    if (Array.isArray(res.data.data.days)) ok('GET /analytics/weekly')
    else fail('weekly', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('weekly', e)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/monthly`, {
      headers: authHeaders(),
      params: { month, year },
    })
    if (res.data.data.month === month && Array.isArray(res.data.data.daily_trend)) {
      ok('GET /analytics/monthly')
    } else fail('monthly', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('monthly', e)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/categories`, {
      headers: authHeaders(),
      params: { start_date: today, end_date: today },
    })
    if (Array.isArray(res.data.data.categories)) ok('GET /analytics/categories')
    else fail('categories', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('categories', e)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/best-days`, {
      headers: authHeaders(),
      params: { start_date: today, end_date: today },
    })
    if (Array.isArray(res.data.data.days)) ok('GET /analytics/best-days')
    else fail('best-days', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('best-days', e)
  }

  try {
    const res = await axios.get(`${BASE}/analytics/streaks`, {
      headers: authHeaders(),
    })
    const d = res.data.data
    if (typeof d.current_streak === 'number' && Array.isArray(d.per_habit)) {
      ok('GET /analytics/streaks')
    } else fail('streaks', new Error(JSON.stringify(d)))
  } catch (e) {
    fail('streaks', e)
  }

  // Empty-ish second user
  try {
    const email2 = `stepg2_${Date.now()}@example.com`
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Empty',
      email: email2,
      password,
    })
    const login2 = await axios.post(`${BASE}/auth/login`, {
      email: email2,
      password,
    })
    const res = await axios.get(`${BASE}/analytics/overview`, {
      headers: { Authorization: `Bearer ${login2.data.data.access_token}` },
    })
    if (res.data.data.active_habits === 0) ok('Empty overview for new user')
    else fail('empty overview', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('empty overview', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
