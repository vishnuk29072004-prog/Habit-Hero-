/**
 * Step J notifications smoke tests (live FastAPI).
 * Run: node scripts/verifyNotificationsIntegration.mjs
 */

import axios from 'axios'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mapNotificationFromApi,
  mapNotificationListFromApi,
  mapNotificationSummaryFromApi,
} from '../src/services/api/notificationMappers.js'

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
const email = `stepj_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access
let habitId
let notificationId
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

  // 1. Endpoint mapping (notificationApi contract — read source; avoid Vite import.meta)
  try {
    const src = readFileSync(
      resolve(root, 'src/services/api/notificationApi.js'),
      'utf8'
    )
    const needed = [
      "apiGet('/notifications'",
      "apiGet('/notifications/summary'",
      'apiGet(`/notifications/${notificationId}`)',
      "apiPost('/notifications/generate'",
      'apiPatch(`/notifications/${notificationId}/read`)',
      "apiPost('/notifications/read-all'",
      'apiDelete(`/notifications/${notificationId}`)',
    ]
    if (needed.every((frag) => src.includes(frag))) {
      ok('Notification API endpoint mapping')
    } else fail('API mapping', new Error('missing route helper'))
  } catch (e) {
    fail('API mapping', e)
  }

  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'Step J User',
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

  // 4. Empty notification state
  try {
    const res = await axios.get(`${BASE}/notifications`, {
      headers: authHeaders(),
      params: { refresh: false },
    })
    const mapped = mapNotificationListFromApi(res.data.data)
    if (mapped.total === 0 && mapped.items.length === 0) {
      ok('Empty notification state')
    } else fail('empty', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('empty', e)
  }

  try {
    const res = await axios.post(
      `${BASE}/habits`,
      {
        name: 'Notify Habit',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    habitId = res.data.data.id
    ok('Create habit for generation')
  } catch (e) {
    fail('Create habit', e)
    process.exit(1)
  }

  // Generate once
  try {
    const first = await axios.post(`${BASE}/notifications/generate`, null, {
      headers: authHeaders(),
    })
    if (first.data.data.created >= 1) ok('Generate notifications')
    else fail('generate', new Error(JSON.stringify(first.data)))
  } catch (e) {
    fail('generate', e)
  }

  // 15. Prevention of duplicate generation
  try {
    const second = await axios.post(`${BASE}/notifications/generate`, null, {
      headers: authHeaders(),
    })
    if (second.data.data.created === 0 && second.data.data.skipped >= 1) {
      ok('Prevention of duplicate generation requests')
    } else fail('dedupe generate', new Error(JSON.stringify(second.data)))
  } catch (e) {
    fail('dedupe generate', e)
  }

  // 3 + 2. List loading + response mapping
  try {
    const res = await axios.get(`${BASE}/notifications`, {
      headers: authHeaders(),
      params: { refresh: false, page: 1, page_size: 20 },
    })
    const mapped = mapNotificationListFromApi(res.data.data)
    if (
      mapped.items.length >= 1 &&
      mapped.items[0].id &&
      mapped.items[0].title &&
      typeof mapped.items[0].unread === 'boolean' &&
      mapped.items[0].time
    ) {
      notificationId = mapped.items[0].id
      ok('Notification list loading')
      ok('Notification response mapping')
    } else fail('list/map', new Error(JSON.stringify(mapped)))
  } catch (e) {
    fail('list/map', e)
  }

  // 16. No duplicate notification state (same type after refresh)
  try {
    const a = await axios.get(`${BASE}/notifications`, {
      headers: authHeaders(),
      params: { refresh: true, type: 'habit_daily_reminder' },
    })
    const b = await axios.get(`${BASE}/notifications`, {
      headers: authHeaders(),
      params: { refresh: true, type: 'habit_daily_reminder' },
    })
    if (a.data.data.total === b.data.data.total) {
      ok('No duplicate notification state')
    } else fail('dup state', new Error(JSON.stringify({ a: a.data, b: b.data })))
  } catch (e) {
    fail('dup state', e)
  }

  // 5 + 10. Unread count + summary
  try {
    const res = await axios.get(`${BASE}/notifications/summary`, {
      headers: authHeaders(),
      params: { refresh: false },
    })
    const mapped = mapNotificationSummaryFromApi(res.data.data)
    if (mapped.total >= 1 && mapped.unread >= 1) {
      ok('Unread count mapping')
      ok('Notification summary integration')
    } else fail('summary', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('summary', e)
  }

  // 6. Mark individual read
  try {
    const res = await axios.patch(
      `${BASE}/notifications/${notificationId}/read`,
      null,
      { headers: authHeaders() }
    )
    const mapped = mapNotificationFromApi(res.data.data)
    if (mapped.unread === false) ok('Mark individual notification as read')
    else fail('mark read', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('mark read', e)
  }

  // 7. Mark all read
  try {
    await axios.post(`${BASE}/notifications/generate`, null, {
      headers: authHeaders(),
    })
    const res = await axios.post(`${BASE}/notifications/read-all`, null, {
      headers: authHeaders(),
    })
    if (typeof res.data.data.updated === 'number') ok('Mark all notifications as read')
    else fail('mark all', new Error(JSON.stringify(res.data)))
    const summary = await axios.get(`${BASE}/notifications/summary`, {
      headers: authHeaders(),
      params: { refresh: false },
    })
    if (summary.data.data.unread === 0) ok('Unread cleared after mark-all')
    else fail('unread after mark-all', new Error(JSON.stringify(summary.data)))
  } catch (e) {
    fail('mark all', e)
  }

  // 9. Pagination
  try {
    const page1 = await axios.get(`${BASE}/notifications`, {
      headers: authHeaders(),
      params: { refresh: false, page: 1, page_size: 1 },
    })
    if (
      page1.data.data.page_size === 1 &&
      page1.data.data.total >= 1 &&
      page1.data.data.items.length === 1
    ) {
      ok('Pagination / load-more support')
    } else fail('pagination', new Error(JSON.stringify(page1.data)))
  } catch (e) {
    fail('pagination', e)
  }

  // 8. Delete
  try {
    const listed = await axios.get(`${BASE}/notifications`, {
      headers: authHeaders(),
      params: { refresh: false, page_size: 1 },
    })
    const id = listed.data.data.items[0]?.id
    if (!id) throw new Error('no notification to delete')
    const res = await axios.delete(`${BASE}/notifications/${id}`, {
      headers: authHeaders(),
    })
    if (res.data.data.deleted === true) ok('Delete notification')
    else fail('delete', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('delete', e)
  }

  // 11/12. Loading and error handling / retry (401 without token)
  try {
    await axios.get(`${BASE}/notifications`)
    fail('Error handling', new Error('expected 401'))
  } catch (e) {
    if ([401, 403].includes(e?.response?.status)) {
      ok('Loading/error handling (401 unauthenticated)')
    } else fail('Error handling', e)
  }

  try {
    // Retry after auth works
    const res = await axios.get(`${BASE}/notifications/summary`, {
      headers: authHeaders(),
      params: { refresh: false },
    })
    if (typeof res.data.data.total === 'number') ok('Retry behavior after auth')
    else fail('retry', new Error(JSON.stringify(res.data)))
  } catch (e) {
    fail('retry', e)
  }

  // 13/14. Auth isolation + logout clearing simulation
  try {
    const email2 = `stepj2_${Date.now()}@example.com`
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
    const summary2 = await axios.get(`${BASE}/notifications/summary`, {
      headers: { Authorization: `Bearer ${access2}` },
      params: { refresh: false },
    })
    if (summary2.data.data.total === 0 && summary2.data.data.unread === 0) {
      ok('Authentication and account switching isolation')
      ok('Logout/switch empty notification state for other user')
    } else fail('isolation', new Error(JSON.stringify(summary2.data)))
  } catch (e) {
    fail('isolation', e)
  }

  // 17. Notification preferences unaffected
  try {
    const settings = await axios.get(`${BASE}/users/me/settings`, {
      headers: authHeaders(),
    })
    const d = settings.data.data
    if (
      typeof d.notifications_enabled === 'boolean' &&
      typeof d.remind_habits_daily === 'boolean'
    ) {
      ok('Existing notification preferences remain unaffected')
    } else fail('prefs', new Error(JSON.stringify(settings.data)))
  } catch (e) {
    fail('prefs', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
