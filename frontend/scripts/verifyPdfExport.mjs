/**
 * Stage F – PDF export smoke.
 * Run: node scripts/verifyPdfExport.mjs
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

/** Mirrors reportApi.toProgressPdfParams (avoid importing Vite modules in Node). */
function toProgressPdfParams({ startDate, endDate } = {}) {
  const start_date = String(startDate || '').trim()
  const end_date = String(endDate || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date)) throw new Error('Start date must be YYYY-MM-DD')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end_date)) throw new Error('End date must be YYYY-MM-DD')
  if (end_date < start_date) throw new Error('End date must not precede start date')
  return { start_date, end_date }
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
  const path = resolve(src, rel)
  const text = readFileSync(path, 'utf8')
  for (const n of needles) {
    if (!text.includes(n)) {
      fail(label, new Error(`missing ${n} in ${rel}`))
      return
    }
  }
  ok(label)
}

const BASE = loadBase()
const email = `pdf_${Date.now()}@example.com`
const password = 'SecurePassword123!'
let access

async function main() {
  console.log(`API base: ${BASE}\n`)

  try {
    toProgressPdfParams({ startDate: '2026-11-01', endDate: '2026-11-30' })
    ok('Date params valid')
  } catch (e) {
    fail('date valid', e)
  }

  try {
    toProgressPdfParams({ startDate: '2026-11-30', endDate: '2026-11-01' })
    fail('reversed dates', new Error('should throw'))
  } catch {
    ok('Date params reject reversed range')
  }

  try {
    toProgressPdfParams({ startDate: 'bad', endDate: '2026-11-30' })
    fail('bad format', new Error('should throw'))
  } catch {
    ok('Date params reject invalid format')
  }

  assertIncludes(
    'pages/Analytics/Analytics.jsx',
    ['PDFExport', 'PDFExportButton', 'exportOpen'],
    'Analytics hosts Export Report modal'
  )
  assertIncludes(
    'components/reports/PDFExport.jsx',
    ['Export Report'],
    'Export Report button label present'
  )
  assertIncludes(
    'components/reports/PDFExport.jsx',
    ['Download PDF', 'loading', 'Retry', 'revokeObjectURL'],
    'PDFExport modal download + loading + retry'
  )
  assertIncludes(
    'services/api/reportApi.js',
    ['/reports/progress/pdf', 'apiGetBlob'],
    'reportApi uses shared blob client'
  )

  // Duplicate request prevention is UI-state (loading guard)
  const pdfExport = readFileSync(resolve(src, 'components/reports/PDFExport.jsx'), 'utf8')
  if (pdfExport.includes('if (loading) return')) ok('Duplicate download guarded while loading')
  else fail('dup guard', new Error('missing loading guard'))

  try {
    await axios.post(`${BASE}/auth/register`, {
      full_name: 'PDF Smoke',
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

  try {
    const res = await axios.get(`${BASE}/reports/progress/pdf`, {
      params: { start_date: '2026-11-01', end_date: '2026-11-30' },
      validateStatus: () => true,
      responseType: 'arraybuffer',
    })
    if ([401, 403].includes(res.status)) ok('Unauthenticated PDF rejected')
    else fail('unauth', new Error(`status ${res.status}`))
  } catch (e) {
    fail('unauth', e)
  }

  try {
    const res = await axios.get(`${BASE}/reports/progress/pdf`, {
      params: { start_date: '2026-11-01', end_date: '2026-11-30' },
      headers: { Authorization: `Bearer ${access}` },
      responseType: 'arraybuffer',
      timeout: 60000,
      validateStatus: () => true,
    })
    if (res.status === 200) {
      const bytes = Buffer.from(res.data)
      if (bytes.slice(0, 4).toString('utf8') === '%PDF') {
        ok(`PDF downloaded (${bytes.length} bytes)`)
        const cd = res.headers['content-disposition'] || ''
        if (cd.includes('HabitHero_Progress_Report')) ok('Content-Disposition filename present')
        else fail('filename', new Error(cd))
      } else fail('magic', new Error('not a PDF'))
    } else {
      fail('download', new Error(`status ${res.status}`))
    }
  } catch (e) {
    fail('download', e)
  }

  console.log(`\nResult: ${passed} passed, ${failed} failed`)
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
