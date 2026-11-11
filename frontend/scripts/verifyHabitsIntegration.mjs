/**
 * Step E habit management smoke tests (live FastAPI).
 * Run: node scripts/verifyHabitsIntegration.mjs
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
const email = `stepe_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access
let dailyId
let weeklyId

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
      full_name: 'Step E User',
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
    const res = await axios.get(`${BASE}/habits`, {
      headers: authHeaders(),
      params: { status: 'all', page_size: 100 },
    })
    if (res.data?.success && Array.isArray(res.data?.data?.items)) {
      ok(`GET /habits (empty=${res.data.data.items.length === 0})`)
    } else fail('GET /habits', new Error('bad shape'))
  } catch (e) {
    fail('GET /habits', e)
  }

  const today = new Date().toISOString().slice(0, 10)

  try {
    const res = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Morning Stretch',
        description: 'Daily mobility',
        notes: '',
        icon: 'sparkles',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    dailyId = res.data?.data?.id
    if (dailyId && res.data.data.frequency === 'Daily' && !res.data.data.is_archived) {
      ok('POST daily habit')
    } else fail('POST daily habit', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST daily habit', e)
  }

  // date-fns / backend: Sun=0 … Sat=6 (JS getDay)
  const todayWeekDay = new Date(`${today}T12:00:00`).getDay()

  try {
    const res = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Weekly Review',
        description: 'Plan the week',
        category: 'Productivity',
        frequency: 'Weekly',
        start_date: today,
        week_day: todayWeekDay,
      },
      { headers: authHeaders() }
    )
    weeklyId = res.data?.data?.id
    if (
      weeklyId &&
      res.data.data.frequency === 'Weekly' &&
      res.data.data.week_day === todayWeekDay
    ) {
      ok(`POST weekly habit (week_day=${todayWeekDay})`)
    } else fail('POST weekly habit', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST weekly habit', e)
  }

  // Explicit Sunday=0 mapping check (may not be scheduled today)
  try {
    const res = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Sunday Only',
        category: 'Learning',
        frequency: 'Weekly',
        start_date: today,
        week_day: 0,
      },
      { headers: authHeaders() }
    )
    if (res.data?.data?.week_day === 0) ok('week_day Sunday=0 accepted')
    else fail('week_day Sunday=0', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('week_day Sunday=0', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/habits/${dailyId}`,
      { name: 'Morning Stretch Updated', category: 'Mental Health', notes: 'calm' },
      { headers: authHeaders() }
    )
    if (
      res.data?.data?.name === 'Morning Stretch Updated' &&
      res.data.data.category === 'Mental Health'
    ) {
      ok('PATCH habit details + category')
    } else fail('PATCH habit', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH habit', e)
  }

  try {
    const res = await axios.get(`${BASE}/habits`, {
      headers: authHeaders(),
      params: { status: 'active', search: 'Stretch', category: 'Mental Health' },
    })
    if (res.data?.data?.items?.some((h) => h.id === dailyId)) ok('List filter search+category')
    else fail('List filter', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('List filter', e)
  }

  try {
    const res = await axios.get(`${BASE}/habits`, {
      headers: authHeaders(),
      params: { frequency: 'Weekly', status: 'all' },
    })
    if (res.data?.data?.items?.some((h) => h.id === weeklyId)) ok('List filter frequency=Weekly')
    else fail('List frequency', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('List frequency', e)
  }

  try {
    const res = await axios.patch(`${BASE}/habits/${dailyId}/archive`, null, {
      headers: authHeaders(),
    })
    if (res.data?.data?.is_archived === true) ok('PATCH archive')
    else fail('PATCH archive', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH archive', e)
  }

  try {
    const res = await axios.get(`${BASE}/habits`, {
      headers: authHeaders(),
      params: { status: 'archived' },
    })
    if (res.data?.data?.items?.some((h) => h.id === dailyId)) ok('GET archived habits')
    else fail('GET archived', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET archived', e)
  }

  try {
    const res = await axios.patch(`${BASE}/habits/${dailyId}/restore`, null, {
      headers: authHeaders(),
    })
    if (res.data?.data?.is_archived === false) ok('PATCH restore')
    else fail('PATCH restore', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH restore', e)
  }

  // Soft-delete with history: create check-in then DELETE should archive
  try {
    await axios.post(
      `${BASE}/habits/${weeklyId}/checkins`,
      { date: today, status: 'completed', notes: 'done' },
      { headers: authHeaders() }
    )
    const res = await axios.delete(`${BASE}/habits/${weeklyId}`, {
      headers: authHeaders(),
    })
    if (res.data?.data?.action === 'archived' && res.data.data.habit?.is_archived) {
      ok('DELETE with history → archive')
    } else fail('DELETE with history', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('DELETE with history', e)
  }

  // Hard delete without history
  try {
    const created = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Temp Delete Me',
        category: 'Work',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    const tempId = created.data.data.id
    const res = await axios.delete(`${BASE}/habits/${tempId}`, {
      headers: authHeaders(),
    })
    if (res.data?.data?.action === 'deleted') ok('DELETE without history → deleted')
    else fail('DELETE without history', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('DELETE without history', e)
  }

  try {
    await axios.post(
      `${BASE}/habits`,
      { name: '', category: 'Health', frequency: 'Daily', start_date: today },
      { headers: authHeaders() }
    )
    fail('Invalid input', new Error('expected 422'))
  } catch (e) {
    if (e?.response?.status === 422 || e?.response?.status === 400) ok('Invalid input rejected')
    else fail('Invalid input', e)
  }

  // Isolation: second user cannot see first user's habit
  try {
    const email2 = `stepe2_${Date.now()}@example.com`
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Step E Other',
      email: email2,
      password,
    })
    const login2 = await axios.post(`${BASE}/auth/login`, {
      email: email2,
      password,
    })
    const access2 = login2.data.data.access_token
    try {
      await axios.get(`${BASE}/habits/${dailyId}`, {
        headers: { Authorization: `Bearer ${access2}` },
      })
      fail('User isolation', new Error('other user could read habit'))
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 403) {
        ok('User isolation (404/403)')
      } else fail('User isolation', e)
    }
  } catch (e) {
    fail('User isolation setup', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
