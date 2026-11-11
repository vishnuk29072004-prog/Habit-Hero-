/**
 * Step F check-ins + calendar smoke tests (live FastAPI).
 * Run: node scripts/verifyCheckinsCalendar.mjs
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
const email = `stepf_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access
let habitId
let checkinId
let noteId
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
      full_name: 'Step F User',
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
        name: 'Step F Daily',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    habitId = res.data.data.id
    ok('Create daily habit')
  } catch (e) {
    fail('Create daily habit', e)
    process.exit(1)
  }

  try {
    const res = await axios.post(
      `${BASE}/habits/${habitId}/checkins`,
      { date: today, status: 'completed', notes: 'done' },
      { headers: authHeaders() }
    )
    checkinId = res.data.data.id
    if (res.data.data.status === 'completed') ok('POST check-in completed')
    else fail('POST check-in', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST check-in', e)
  }

  try {
    await axios.post(
      `${BASE}/habits/${habitId}/checkins`,
      { date: today, status: 'completed' },
      { headers: authHeaders() }
    )
    fail('Duplicate check-in', new Error('expected 409'))
  } catch (e) {
    if (e?.response?.status === 409) ok('Duplicate check-in rejected (409)')
    else fail('Duplicate check-in', e)
  }

  try {
    const res = await axios.get(`${BASE}/habits/${habitId}/checkins/${today}`, {
      headers: authHeaders(),
    })
    if (res.data?.data?.id === checkinId) ok('GET check-in by date')
    else fail('GET by date', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET by date', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/habits/${habitId}/checkins/${checkinId}`,
      { status: 'incomplete', notes: 'undone' },
      { headers: authHeaders() }
    )
    if (res.data.data.status === 'incomplete') ok('PATCH check-in incomplete')
    else fail('PATCH check-in', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH check-in', e)
  }

  try {
    await axios.patch(
      `${BASE}/habits/${habitId}/checkins/${checkinId}`,
      { status: 'completed' },
      { headers: authHeaders() }
    )
    ok('PATCH check-in re-complete')
  } catch (e) {
    fail('PATCH re-complete', e)
  }

  try {
    const res = await axios.get(`${BASE}/calendar/monthly`, {
      headers: authHeaders(),
      params: { month, year },
    })
    const day = res.data?.data?.days?.find((d) => d.date === today)
    if (day && day.completed >= 1) ok('GET calendar/monthly')
    else fail('GET monthly', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET monthly', e)
  }

  try {
    const res = await axios.get(`${BASE}/calendar/daily`, {
      headers: authHeaders(),
      params: { date: today },
    })
    const habit = res.data?.data?.habits?.find((h) => h.habit_id === habitId)
    if (habit?.status === 'completed') ok('GET calendar/daily')
    else fail('GET daily', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET daily', e)
  }

  try {
    const res = await axios.get(`${BASE}/calendar/summary`, {
      headers: authHeaders(),
      params: { start_date: today, end_date: today },
    })
    if (typeof res.data?.data?.completion_percentage === 'number') {
      ok('GET calendar/summary')
    } else fail('GET summary', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET summary', e)
  }

  try {
    const res = await axios.post(
      `${BASE}/calendar/notes`,
      { date: today, notes: 'Focus day' },
      { headers: authHeaders() }
    )
    noteId = res.data.data.id
    if (noteId && res.data.data.notes === 'Focus day') ok('POST day note')
    else fail('POST day note', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST day note', e)
  }

  try {
    await axios.post(
      `${BASE}/calendar/notes`,
      { date: today, notes: 'dup' },
      { headers: authHeaders() }
    )
    fail('Duplicate day note', new Error('expected 409'))
  } catch (e) {
    if (e?.response?.status === 409) ok('Duplicate day note rejected (409)')
    else fail('Duplicate day note', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/calendar/notes/${noteId}`,
      { notes: 'Updated focus' },
      { headers: authHeaders() }
    )
    if (res.data.data.notes === 'Updated focus') ok('PATCH day note')
    else fail('PATCH day note', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH day note', e)
  }

  try {
    const res = await axios.get(`${BASE}/calendar/notes`, {
      headers: authHeaders(),
      params: { date: today },
    })
    if (res.data?.data?.some((n) => n.id === noteId)) ok('GET day notes')
    else fail('GET day notes', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET day notes', e)
  }

  try {
    const daily = await axios.get(`${BASE}/calendar/daily`, {
      headers: authHeaders(),
      params: { date: today },
    })
    if (daily.data?.data?.summary?.has_notes === true) ok('Daily has_notes flag')
    else fail('has_notes', new Error(JSON.stringify(daily.data)))
  } catch (e) {
    fail('has_notes', e)
  }

  try {
    await axios.delete(`${BASE}/calendar/notes/${noteId}`, {
      headers: authHeaders(),
    })
    ok('DELETE day note')
  } catch (e) {
    fail('DELETE day note', e)
  }

  try {
    await axios.delete(`${BASE}/habits/${habitId}/checkins/${checkinId}`, {
      headers: authHeaders(),
    })
    ok('DELETE check-in')
  } catch (e) {
    fail('DELETE check-in', e)
  }

  // Unscheduled weekday rejected (Weekly habit; UI also blocks future via isFuture)
  const todayWeekDay = new Date(`${today}T12:00:00`).getDay()
  const otherWeekDay = (todayWeekDay + 1) % 7
  let weeklyId
  try {
    const created = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Weekly Only',
        category: 'Work',
        frequency: 'Weekly',
        start_date: today,
        week_day: otherWeekDay,
      },
      { headers: authHeaders() }
    )
    weeklyId = created.data.data.id
    await axios.post(
      `${BASE}/habits/${weeklyId}/checkins`,
      { date: today, status: 'completed' },
      { headers: authHeaders() }
    )
    fail('Unscheduled check-in', new Error('expected 400'))
  } catch (e) {
    if (e?.response?.status === 400) ok('Unscheduled weekday check-in rejected')
    else fail('Unscheduled check-in', e)
  }

  // Isolation
  try {
    const email2 = `stepf2_${Date.now()}@example.com`
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Other',
      email: email2,
      password,
    })
    const login2 = await axios.post(`${BASE}/auth/login`, {
      email: email2,
      password,
    })
    const access2 = login2.data.data.access_token
    try {
      await axios.get(`${BASE}/habits/${habitId}/checkins`, {
        headers: { Authorization: `Bearer ${access2}` },
      })
      fail('Check-in isolation', new Error('other user accessed habit checkins'))
    } catch (e) {
      if (e?.response?.status === 404 || e?.response?.status === 403) {
        ok('Check-in ownership isolation')
      } else fail('Check-in isolation', e)
    }
  } catch (e) {
    fail('Isolation setup', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
