/**
 * Stage E – AI Insights page integration smoke.
 * Run: node scripts/verifyAiInsightsPage.mjs
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import axios from 'axios'

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
  console.error(`  FAIL  ${l}: ${e?.message || e}`)
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

function assertIncludes(fileRel, needles, label) {
  const path = resolve(src, fileRel)
  if (!existsSync(path)) {
    fail(label, new Error(`missing ${fileRel}`))
    return
  }
  const text = readFileSync(path, 'utf8')
  for (const n of needles) {
    if (!text.includes(n)) {
      fail(label, new Error(`expected "${n}" in ${fileRel}`))
      return
    }
  }
  ok(label)
}

async function main() {
  console.log('AI Insights page contract checks\n')

  assertIncludes(
    'pages/AIInsights/AIInsights.jsx',
    [
      'Your Personal AI Growth Assistant',
      'HabitSuggestions',
      'JournalMoodAnalysis',
      'ai-habit-suggestions',
      'ai-journal-analysis',
    ],
    'AIInsights page composes sections + shortcuts'
  )

  assertIncludes(
    'App.jsx',
    ['ai-insights', 'AIInsights'],
    'App registers /ai-insights route'
  )

  assertIncludes(
    'components/layout/Sidebar.jsx',
    ["'/ai-insights'", 'AI Insights', 'Sparkles'],
    'Sidebar includes AI Insights with Sparkles'
  )

  assertIncludes(
    'components/ai/HabitSuggestions.jsx',
    ['up to about 90 seconds', 'Generate Suggestions', 'addHabit'],
    'HabitSuggestions long-wait + generate + addHabit'
  )

  assertIncludes(
    'components/ai/JournalMoodAnalysis.jsx',
    ['Analyze My Journal', 'up to about 90 seconds', 'at least three'],
    'JournalMoodAnalysis CTA + wait + empty guidance'
  )

  // Confirm no auto-trigger patterns on the page (no useEffect calling AI)
  const page = readFileSync(resolve(src, 'pages/AIInsights/AIInsights.jsx'), 'utf8')
  if (/useEffect/.test(page) || /habitSuggestions\(|moodAnalysis\(/.test(page)) {
    fail('no auto Gemini on page', new Error('page must not call AI APIs or useEffect-trigger'))
  } else {
    ok('AIInsights page does not auto-call Gemini APIs')
  }

  const BASE = loadBase()
  try {
    const res = await axios.get(`${BASE.replace(/\/api\/v1$/, '')}/api/v1/health`, {
      validateStatus: () => true,
      timeout: 5000,
    })
    if (res.status === 200) ok('Backend health reachable for integration context')
    else fail('health', new Error(`status ${res.status}`))
  } catch (e) {
    fail('health', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
