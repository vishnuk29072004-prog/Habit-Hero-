/**
 * Stage G – Google Calendar smoke (contract + optional live status).
 * Run: node scripts/verifyGoogleCalendar.mjs
 */

import axios from 'axios'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const src = resolve(root, 'src')

let passed = 0
let failed = 0

function ok(l) {
  passed += 1
  console.log(`  PASS  ${l}`)
}
function fail(l, e) {
  failed += 1
  console.error(`  FAIL  ${l}: ${e?.response?.data?.detail || e?.message || e}`)
}

function loadBase() {
  for (const name of ['.env', '.env.example']) {
    const path = resolve(root, name)
    if (!existsSync(path)) continue
    const m = readFileSync(path, 'utf8').match(/^VITE_API_BASE_URL\s*=\s*(.+)$/m)
    if (m) return m[1].trim().replace(/\/+$/, '')
  }
  return 'http://127.0.0.1:8000/api/v1'
}

function assertIncludes(rel, needles, label) {
  const text = readFileSync(resolve(src, rel), 'utf8')
  for (const n of needles) {
    if (!text.includes(n)) {
      fail(label, new Error(`missing ${n}`))
      return
    }
  }
  ok(label)
}

const BASE = loadBase()
const email = `gcal_${Date.now()}@example.com`
const password = 'SecurePassword123!'

async function main() {
  console.log(`API base: ${BASE}\n`)

  assertIncludes(
    'pages/Settings/Settings.jsx',
    ['GoogleCalendarSettings'],
    'Settings hosts Google Calendar panel'
  )
  assertIncludes(
    'components/settings/GoogleCalendarSettings.jsx',
    ['Connect Google Calendar', 'Sync Now', 'Disconnect'],
    'Google Calendar UI actions present'
  )
  assertIncludes(
    'services/api/googleCalendarApi.js',
    ['/calendar/google/status', '/calendar/google/connect', '/calendar/google/sync'],
    'googleCalendarApi paths'
  )

  // Ensure frontend source never hardcodes client secret
  const settingsUi = readFileSync(
    resolve(src, 'components/settings/GoogleCalendarSettings.jsx'),
    'utf8'
  )
  // Allow documenting env var names; reject hardcoded secret assignments/values.
  if (/client_secret\s*[:=]\s*['"][^'"]+['"]/i.test(settingsUi)) {
    fail('no secret in UI', new Error('hardcoded client_secret in component'))
  } else ok('UI source has no hardcoded client secret')

  let access
  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'GCal Smoke',
      email,
      password,
    })
    const login = await axios.post(`${BASE}/auth/login`, { email, password })
    access = login.data.data.access_token
    ok('Register + login')
  } catch (e) {
    fail('auth', e)
    process.exit(1)
  }

  const headers = { Authorization: `Bearer ${access}` }

  try {
    const res = await axios.get(`${BASE}/calendar/google/status`, {
      validateStatus: () => true,
    })
    if ([401, 403].includes(res.status)) ok('Unauthenticated status rejected')
    else fail('unauth', new Error(`status ${res.status}`))
  } catch (e) {
    fail('unauth', e)
  }

  try {
    const res = await axios.get(`${BASE}/calendar/google/status`, { headers })
    if (res.status === 200 && typeof res.data.data.connected === 'boolean') {
      ok(`Status reachable (connected=${res.data.data.connected}, configured=${res.data.data.configured})`)
      const blob = JSON.stringify(res.data)
      if (/access_token|refresh_token|CLIENT_SECRET/i.test(blob)) {
        fail('token leak', new Error('sensitive fields in status'))
      } else ok('Status payload has no tokens/secrets')
    } else fail('status', new Error(`status ${res.status}`))
  } catch (e) {
    fail('status', e)
  }

  try {
    const res = await axios.get(`${BASE}/calendar/google/connect`, {
      headers,
      validateStatus: () => true,
    })
    if (res.status === 200 && res.data?.data?.authorization_url) {
      ok('Connect returns authorization_url')
    } else if (res.status === 503) {
      ok('Connect blocked until Google env configured (503)')
    } else fail('connect', new Error(`status ${res.status}`))
  } catch (e) {
    fail('connect', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  console.log(
    'Note: Live Google consent/OAuth browser flow is manual and not claimed here.'
  )
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
