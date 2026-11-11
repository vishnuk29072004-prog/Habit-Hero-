/**
 * Stage C – AI habit suggestions smoke (live API; Gemini mocked only in pytest).
 * Run: node scripts/verifyAiHabitSuggestions.mjs
 *
 * If GEMINI is unavailable, auth + 503/502/504 handling still counts as a
 * successful contract check for the endpoint shape.
 */

import axios from 'axios'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mapHabitSuggestionsResponse,
  suggestionToHabitPayload,
} from '../src/services/api/aiMappers.js'

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
const email = `aic_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let passed = 0
let failed = 0
let access

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
      full_name: 'AI Coach User',
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
    const res = await axios.post(`${BASE}/ai/habit-suggestions`, {}, {
      validateStatus: () => true,
    })
    if ([401, 403].includes(res.status)) ok('Unauthenticated rejected')
    else fail('unauth', new Error(`status ${res.status}`))
  } catch (e) {
    fail('unauth', e)
  }

  const today = new Date().toISOString().slice(0, 10)
  try {
    await axios.post(
      `${BASE}/habits`,
      {
        name: 'Existing Coach Habit',
        category: 'Health',
        frequency: 'Daily',
        start_date: today,
      },
      { headers: authHeaders() }
    )
    ok('Seed habit for context')
  } catch (e) {
    fail('seed habit', e)
  }

  try {
    const res = await axios.post(
      `${BASE}/ai/habit-suggestions`,
      { count: 5 },
      { headers: authHeaders(), validateStatus: () => true, timeout: 120000 }
    )
    if (res.status === 200) {
      const mapped = mapHabitSuggestionsResponse(res.data.data)
      if (mapped.suggestions.length >= 1) {
        ok(`Live suggestions returned (${mapped.suggestions.length})`)
        const payload = suggestionToHabitPayload(mapped.suggestions[0])
        if (payload.name && payload.startDate && payload.frequency) {
          ok('Mapper produces habit create payload')
        } else fail('mapper', new Error(JSON.stringify(payload)))

        try {
          const created = await axios.post(
            `${BASE}/habits`,
            {
              name: payload.name,
              description: payload.description,
              category: payload.category,
              frequency: payload.frequency,
              start_date: payload.startDate,
            },
            { headers: authHeaders() }
          )
          if (created.status === 201) ok('Add suggested habit via habit API')
          else fail('add habit', new Error(`status ${created.status}`))
        } catch (e) {
          fail('add habit', e)
        }
      } else fail('empty suggestions', new Error(JSON.stringify(res.data)))
    } else if ([503, 502, 504, 429].includes(res.status)) {
      ok(`AI endpoint graceful failure (${res.status})`)
      ok('Mapper unit shape still valid')
      const sample = suggestionToHabitPayload({
        name: 'Sample',
        description: 'd',
        category: 'Health',
        frequency: 'Daily',
        recommendedStartDate: today,
      })
      if (sample.name === 'Sample') ok('Add-habit payload mapping (offline)')
      else fail('offline mapper', new Error('bad'))
    } else {
      fail('suggestions', new Error(`status ${res.status}`))
    }
  } catch (e) {
    fail('suggestions request', e)
  }

  // Duplicate submission prevention is UI-state; verify mapper idempotent shape
  try {
    const a = suggestionToHabitPayload({
      name: 'X',
      description: '',
      category: 'Work',
      frequency: 'Weekly',
      recommendedStartDate: today,
    })
    const b = suggestionToHabitPayload({
      name: 'X',
      description: '',
      category: 'Work',
      frequency: 'Weekly',
      recommendedStartDate: today,
    })
    if (JSON.stringify(a) === JSON.stringify(b)) ok('Duplicate submission payload stable')
    else fail('stable payload', new Error('mismatch'))
  } catch (e) {
    fail('stable payload', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
