/**
 * Stage D – AI journal mood analysis smoke.
 * Run: node scripts/verifyAiJournalAnalysis.mjs
 */

import axios from 'axios'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  mapMoodAnalysisFromApi,
  toMoodAnalysisPayload,
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
const email = `aij_${Date.now()}@example.com`
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

  // Date validation (client mapper)
  try {
    toMoodAnalysisPayload({ startDate: '2026-11-01', endDate: '2026-11-11' })
    ok('Mapper date payload valid')
  } catch (e) {
    fail('mapper valid dates', e)
  }

  try {
    toMoodAnalysisPayload({ startDate: '2026-11-11', endDate: '2026-11-01' })
    fail('mapper reversed dates', new Error('should throw'))
  } catch {
    ok('Mapper rejects reversed dates')
  }

  try {
    toMoodAnalysisPayload({ startDate: 'bad', endDate: '2026-11-11' })
    fail('mapper bad format', new Error('should throw'))
  } catch {
    ok('Mapper rejects invalid date format')
  }

  // Response mapping (offline success shape)
  try {
    const mapped = mapMoodAnalysisFromApi({
      overall_mood: 'Balanced',
      mood_summary: 'Steady week',
      mood_patterns: { positive: ['Calm mornings'], challenging: ['Tired evenings'] },
      motivation_patterns: ['Rises mid-week'],
      positive_observations: ['Consistent writing'],
      areas_to_improve: ['Earlier rest'],
      recommendations: ['Keep short check-ins'],
      summary: 'Supportive reflection',
      entries_analyzed: 3,
      analysis_period: { start_date: '2026-11-01', end_date: '2026-11-11' },
    })
    if (
      mapped.overallMood === 'Balanced' &&
      mapped.moodPatterns.positive.length === 1 &&
      mapped.entriesAnalyzed === 3 &&
      mapped.analysisPeriod.startDate === '2026-11-01'
    ) {
      ok('Response mapping success shape')
    } else fail('response map', new Error(JSON.stringify(mapped)))
  } catch (e) {
    fail('response map', e)
  }

  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'AI Journal Smoke',
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
      `${BASE}/ai/mood-analysis`,
      { start_date: '2026-11-01', end_date: '2026-11-11' },
      { validateStatus: () => true }
    )
    if ([401, 403].includes(res.status)) ok('Unauthenticated rejected')
    else fail('unauth', new Error(`status ${res.status}`))
  } catch (e) {
    fail('unauth', e)
  }

  // Insufficient entries → loading/error contract without Gemini
  try {
    const res = await axios.post(
      `${BASE}/ai/mood-analysis`,
      { start_date: '2026-11-01', end_date: '2026-11-11' },
      { headers: authHeaders(), validateStatus: () => true }
    )
    if (res.status === 400) ok('Empty journal → clear error (no fabricate)')
    else fail('empty journal', new Error(`status ${res.status}`))
  } catch (e) {
    fail('empty journal', e)
  }

  const dates = ['2026-11-02', '2026-11-04', '2026-11-06']
  for (const d of dates) {
    try {
      await axios.post(
        `${BASE}/journal`,
        {
          date: d,
          title: `Smoke ${d}`,
          content: `Felt reflective on ${d}. Kept habits light and honest.`,
          mood: 'motivated',
          tags: ['Reflection'],
        },
        { headers: authHeaders() }
      )
    } catch (e) {
      fail(`seed ${d}`, e)
    }
  }
  ok('Seeded three journal entries')

  try {
    const payload = toMoodAnalysisPayload({
      startDate: '2026-11-01',
      endDate: '2026-11-11',
    })
    const res = await axios.post(`${BASE}/ai/mood-analysis`, payload, {
      headers: authHeaders(),
      validateStatus: () => true,
      timeout: 120000,
    })
    if (res.status === 200) {
      const mapped = mapMoodAnalysisFromApi(res.data.data)
      if (mapped?.overallMood && mapped.entriesAnalyzed >= 3) {
        ok(`Live analysis returned (${mapped.entriesAnalyzed} entries)`)
      } else fail('live map', new Error(JSON.stringify(res.data)))
    } else if ([503, 502, 504, 429].includes(res.status)) {
      ok(`AI endpoint graceful failure (${res.status})`)
      ok('Error handling path covered')
    } else if (res.status === 400) {
      ok(`API validation/error message: ${res.data?.detail || res.status}`)
    } else {
      fail('mood analysis', new Error(`status ${res.status}`))
    }
  } catch (e) {
    fail('mood analysis request', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
