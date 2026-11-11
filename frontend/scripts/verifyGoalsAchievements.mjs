/**
 * Step H goals + achievements smoke tests (live FastAPI).
 * Run: node scripts/verifyGoalsAchievements.mjs
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
const email = `steph_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access
let habitId
let goalId
const today = new Date().toISOString().slice(0, 10)
const end = new Date()
end.setDate(end.getDate() + 29)
const endDate = end.toISOString().slice(0, 10)

const TARGET_TYPES = [
  'completion_count',
  'consecutive_days',
  'days_completed',
  'completion_percentage',
]

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
      full_name: 'Step H User',
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
        name: 'Goal Habit',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    habitId = res.data.data.id
    ok('Create linked habit')
  } catch (e) {
    fail('Create linked habit', e)
    process.exit(1)
  }

  try {
    const res = await axios.post(
      `${BASE}/goals`,
      {
        name: 'Complete 5 times',
        description: 'Test goal',
        category: 'Health',
        linked_habit_id: habitId,
        target_type: 'completion_count',
        target_value: 5,
        start_date: today,
        end_date: endDate,
        notes: '',
      },
      { headers: authHeaders() }
    )
    goalId = res.data.data.id
    if (res.data.data.status && res.data.data.progress) ok('POST goal')
    else fail('POST goal', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST goal', e)
  }

  try {
    const res = await axios.get(`${BASE}/goals`, {
      headers: authHeaders(),
      params: { page_size: 50 },
    })
    if (res.data.data.items.some((g) => g.id === goalId)) ok('GET /goals')
    else fail('GET goals', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET goals', e)
  }

  try {
    const res = await axios.get(`${BASE}/goals/${goalId}`, {
      headers: authHeaders(),
    })
    if (res.data.data.id === goalId) ok('GET /goals/{id}')
    else fail('GET goal', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET goal', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/goals/${goalId}`,
      { name: 'Complete 5 times (updated)', target_value: 6 },
      { headers: authHeaders() }
    )
    if (res.data.data.name.includes('updated') && res.data.data.target_value === 6) {
      ok('PATCH goal')
    } else fail('PATCH goal', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH goal', e)
  }

  try {
    const res = await axios.get(`${BASE}/goals/summary`, {
      headers: authHeaders(),
    })
    if (typeof res.data.data.total === 'number') ok('GET /goals/summary')
    else fail('summary', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('summary', e)
  }

  // Remaining target types
  for (const type of TARGET_TYPES.filter((t) => t !== 'completion_count')) {
    try {
      const payload = {
        name: `Type ${type}`,
        category: 'Work',
        target_type: type,
        target_value: type === 'completion_percentage' ? 80 : 3,
        start_date: today,
        end_date: endDate,
      }
      if (type !== 'completion_percentage') payload.linked_habit_id = habitId
      const res = await axios.post(`${BASE}/goals`, payload, {
        headers: authHeaders(),
      })
      if (res.data.data.target_type === type) ok(`Create ${type}`)
      else fail(`Create ${type}`, new Error(JSON.stringify(res.data)))
    } catch (e) {
      fail(`Create ${type}`, e)
    }
  }

  try {
    await axios.post(
      `${BASE}/goals`,
      {
        name: 'Bad',
        category: 'Health',
        target_type: 'completion_percentage',
        target_value: 150,
        start_date: today,
        end_date: endDate,
      },
      { headers: authHeaders() }
    )
    fail('Invalid target', new Error('expected rejection'))
  } catch (e) {
    if (e?.response?.status === 422 || e?.response?.status === 400) {
      ok('Invalid target rejected')
    } else fail('Invalid target', e)
  }

  // Achievements
  try {
    const res = await axios.get(`${BASE}/achievements`, {
      headers: authHeaders(),
    })
    if (Array.isArray(res.data.data)) ok('GET /achievements')
    else fail('achievements list', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('achievements list', e)
  }

  try {
    const res = await axios.get(`${BASE}/achievements/summary`, {
      headers: authHeaders(),
    })
    const cat = res.data.data.catalogue
    if (Array.isArray(cat) && cat.length === 8) ok('GET /achievements/summary (8 defs)')
    else fail('achievements summary', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('achievements summary', e)
  }

  // Progress via check-in → refresh achievements
  try {
    await axios.post(
      `${BASE}/habits/${habitId}/checkins`,
      { date: today, status: 'completed' },
      { headers: authHeaders() }
    )
    const goal = await axios.get(`${BASE}/goals/${goalId}`, {
      headers: authHeaders(),
    })
    if (typeof goal.data.data.progress?.rate === 'number') {
      ok('Goal progress after check-in')
    } else fail('Goal progress', new Error(JSON.stringify(goal.data)))
  } catch (e) {
    fail('Goal progress after check-in', e)
  }

  try {
    await axios.delete(`${BASE}/goals/${goalId}`, { headers: authHeaders() })
    ok('DELETE goal')
  } catch (e) {
    fail('DELETE goal', e)
  }

  // Isolation
  try {
    const email2 = `steph2_${Date.now()}@example.com`
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
    const summary = await axios.get(`${BASE}/goals/summary`, {
      headers: { Authorization: `Bearer ${access2}` },
    })
    if (summary.data.data.total === 0) ok('Goal isolation (empty other user)')
    else fail('isolation', new Error(JSON.stringify(summary.data)))
  } catch (e) {
    fail('isolation', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
