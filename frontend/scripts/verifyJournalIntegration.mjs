/**
 * Step I journal smoke tests (live FastAPI).
 * Run: node scripts/verifyJournalIntegration.mjs
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
const email = `stepi_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access
let habitId
let entryId
let generalId
const today = new Date().toISOString().slice(0, 10)

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
      full_name: 'Step I User',
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
        name: 'Journal Habit',
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

  // CRUD
  try {
    const res = await axios.post(
      `${BASE}/journal`,
      {
        date: today,
        title: 'Morning note',
        content: 'Felt focused after the workout.',
        mood: 'motivated',
        tags: ['Health', 'Motivation'],
        habit_id: habitId,
      },
      { headers: authHeaders() }
    )
    entryId = res.data.data.id
    if (res.data.data.habit_id === habitId && res.data.data.mood === 'motivated') {
      ok('POST /journal')
    } else fail('POST /journal', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST /journal', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { page_size: 20 },
    })
    if (res.data.data.items.some((e) => e.id === entryId)) ok('GET /journal')
    else fail('GET /journal', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET /journal', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal/${entryId}`, {
      headers: authHeaders(),
    })
    if (res.data.data.id === entryId) ok('GET /journal/{id}')
    else fail('GET /journal/{id}', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('GET /journal/{id}', e)
  }

  try {
    const res = await axios.post(
      `${BASE}/journal`,
      {
        date: today,
        title: 'General',
        content: 'No habit linked.',
        mood: 'neutral',
        tags: ['Reflection'],
      },
      { headers: authHeaders() }
    )
    generalId = res.data.data.id
    if (res.data.data.habit_id == null) ok('POST general journal entry')
    else fail('POST general', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('POST general', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/journal/${entryId}`,
      {
        title: 'Updated morning note',
        content: 'Still focused, slightly tired.',
        mood: 'productive',
        tags: ['Health', 'Reflection'],
      },
      { headers: authHeaders() }
    )
    const d = res.data.data
    if (
      d.title.includes('Updated') &&
      d.mood === 'productive' &&
      d.tags.length === 2 &&
      !d.tags.includes('Motivation')
    ) {
      ok('PATCH /journal (tag replace-set)')
    } else fail('PATCH /journal', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('PATCH /journal', e)
  }

  try {
    const res = await axios.patch(
      `${BASE}/journal/${entryId}`,
      { clear_habit: true },
      { headers: authHeaders() }
    )
    if (res.data.data.habit_id == null) ok('Clear habit association')
    else fail('clear_habit', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('clear_habit', e)
  }

  try {
    await axios.patch(
      `${BASE}/journal/${entryId}`,
      { habit_id: habitId },
      { headers: authHeaders() }
    )
    ok('Re-link habit')
  } catch (e) {
    fail('Re-link habit', e)
  }

  // Filters
  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { search: 'focused', sort: 'newest' },
    })
    if (res.data.data.items.some((e) => e.id === entryId)) ok('Filter search')
    else fail('search', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('search', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { start_date: today, end_date: today },
    })
    if (res.data.data.total >= 2) ok('Filter date range')
    else fail('date range', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('date range', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { mood: 'productive' },
    })
    const items = res.data.data.items
    if (
      items.length >= 1 &&
      items.every((e) => e.mood === 'productive')
    ) {
      ok('Filter mood')
    } else fail('mood', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('mood', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { tag: 'Reflection' },
    })
    const items = res.data.data.items
    if (
      items.length >= 1 &&
      items.every((e) => e.tags.includes('Reflection'))
    ) {
      ok('Filter tags')
    } else fail('tags', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('tags', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { habit_id: habitId },
    })
    const items = res.data.data.items
    if (items.length >= 1 && items.every((e) => e.habit_id === habitId)) {
      ok('Filter associated habit')
    } else fail('habit_id', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('habit_id', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { habit_id: 'general' },
    })
    if (
      res.data.data.items.length >= 1 &&
      res.data.data.items.every((e) => e.habit_id == null)
    ) {
      ok('Filter general entries')
    } else fail('general', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('general', e)
  }

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const olderDate = yesterday.toISOString().slice(0, 10)
    await axios.post(
      `${BASE}/journal`,
      {
        date: olderDate,
        title: 'Older',
        content: 'Older day entry for sort check.',
        mood: 'tired',
        tags: ['Reflection'],
      },
      { headers: authHeaders() }
    )
    const newest = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { sort: 'newest', page_size: 10 },
    })
    const oldest = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { sort: 'oldest', page_size: 10 },
    })
    const n = newest.data.data.items
    const o = oldest.data.data.items
    if (
      n.length >= 2 &&
      o.length >= 2 &&
      n[0].date >= n[n.length - 1].date &&
      o[0].date <= o[o.length - 1].date &&
      n[0].date !== o[0].date
    ) {
      ok('Newest/oldest sorting')
    } else fail('sort', new Error(JSON.stringify({ newest: n, oldest: o })))
  } catch (e) {
    fail('sort', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { page: 1, page_size: 1 },
    })
    if (res.data.data.page_size === 1 && res.data.data.total >= 2) {
      ok('Pagination')
    } else fail('pagination', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('pagination', e)
  }

  // Validation
  try {
    await axios.post(
      `${BASE}/journal`,
      { date: today, content: 'x', mood: 'ecstatic' },
      { headers: authHeaders() }
    )
    fail('Invalid mood', new Error('expected rejection'))
  } catch (e) {
    if (e?.response?.status === 422 || e?.response?.status === 400) {
      ok('Invalid mood rejected')
    } else fail('Invalid mood', e)
  }

  try {
    await axios.post(
      `${BASE}/journal`,
      { date: today, content: 'x', tags: ['NotARealTag'] },
      { headers: authHeaders() }
    )
    fail('Invalid tags', new Error('expected rejection'))
  } catch (e) {
    if (e?.response?.status === 422 || e?.response?.status === 400) {
      ok('Invalid tags rejected')
    } else fail('Invalid tags', e)
  }

  try {
    await axios.post(
      `${BASE}/journal`,
      { date: today, content: '   ' },
      { headers: authHeaders() }
    )
    fail('Empty content', new Error('expected rejection'))
  } catch (e) {
    if (e?.response?.status === 422 || e?.response?.status === 400) {
      ok('Empty content rejected')
    } else fail('Empty content', e)
  }

  try {
    await axios.post(
      `${BASE}/journal`,
      { date: '11-15-2026', content: 'bad date' },
      { headers: authHeaders() }
    )
    fail('Invalid date', new Error('expected rejection'))
  } catch (e) {
    if (e?.response?.status === 422 || e?.response?.status === 400) {
      ok('Invalid date rejected')
    } else fail('Invalid date', e)
  }

  try {
    await axios.post(
      `${BASE}/journal`,
      {
        date: today,
        content: 'bad habit',
        habit_id: '00000000-0000-0000-0000-000000000000',
      },
      { headers: authHeaders() }
    )
    fail('Invalid habit ID', new Error('expected rejection'))
  } catch (e) {
    if ([400, 404, 422].includes(e?.response?.status)) {
      ok('Invalid habit ID rejected')
    } else fail('Invalid habit ID', e)
  }

  // Other user's habit
  try {
    const email2 = `stepi2_${Date.now()}@example.com`
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
    const habit2 = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Other Habit',
        category: 'Work',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: { Authorization: `Bearer ${access2}` } }
    )
    try {
      await axios.post(
        `${BASE}/journal`,
        {
          date: today,
          content: 'steal habit',
          habit_id: habit2.data.data.id,
        },
        { headers: authHeaders() }
      )
      fail("Other user's habit", new Error('expected rejection'))
    } catch (e) {
      if ([400, 403, 404, 422].includes(e?.response?.status)) {
        ok("Other user's habit rejected")
      } else fail("Other user's habit", e)
    }

    const summary2 = await axios.get(`${BASE}/journal/summary`, {
      headers: { Authorization: `Bearer ${access2}` },
    })
    if (summary2.data.data.total_entries === 0) ok('Journal isolation')
    else fail('isolation', new Error(JSON.stringify(summary2.data)))
  } catch (e) {
    fail('Other user setup', e)
  }

  // Summary
  try {
    const res = await axios.get(`${BASE}/journal/summary`, {
      headers: authHeaders(),
      params: { period: 'thisMonth' },
    })
    const d = res.data.data
    if (
      d.total_entries >= 2 &&
      typeof d.current_streak === 'number' &&
      d.overview?.period === 'thisMonth' &&
      Array.isArray(d.mood_breakdown) &&
      Array.isArray(d.tag_breakdown) &&
      Array.isArray(d.recent_dates)
    ) {
      ok('GET /journal/summary')
    } else fail('summary', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('summary', e)
  }

  // Calendar has_journal (separate from day_notes)
  try {
    const cal = await axios.get(`${BASE}/calendar/daily`, {
      headers: authHeaders(),
      params: { date: today },
    })
    if (cal.data?.data?.summary?.has_journal === true) {
      ok('Calendar has_journal after create')
    } else fail('has_journal', new Error(JSON.stringify(cal.data)))
  } catch (e) {
    fail('Calendar has_journal', e)
  }

  try {
    const notes = await axios.get(`${BASE}/calendar/notes`, {
      headers: authHeaders(),
      params: { date: today },
    })
    const items = Array.isArray(notes.data.data) ? notes.data.data : []
    if (items.length === 0) ok('Journal separate from day_notes')
    else fail('day_notes leak', new Error(JSON.stringify(notes.data)))
  } catch (e) {
    fail('day_notes check', e)
  }

  try {
    const listed = await axios.get(`${BASE}/journal`, {
      headers: authHeaders(),
      params: { page_size: 100 },
    })
    for (const item of listed.data.data.items) {
      await axios.delete(`${BASE}/journal/${item.id}`, {
        headers: authHeaders(),
      })
    }
    ok('DELETE journal entries')
  } catch (e) {
    fail('DELETE', e)
  }

  try {
    const res = await axios.get(`${BASE}/journal/summary`, {
      headers: authHeaders(),
    })
    if (res.data.data.total_entries === 0) ok('Empty dataset after delete')
    else fail('empty', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('empty after delete', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
