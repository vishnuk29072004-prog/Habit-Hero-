import { useCallback, useState } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import { aiApi } from '../../services/api/aiApi'
import {
  mapMoodAnalysisFromApi,
  toMoodAnalysisPayload,
} from '../../services/api/aiMappers'
import EmptyState from '../common/EmptyState'
import './JournalMoodAnalysis.css'

function defaultRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - 10)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { startDate: iso(start), endDate: iso(end) }
}

function JournalMoodAnalysis() {
  const initial = defaultRange()
  const [startDate, setStartDate] = useState(initial.startDate)
  const [endDate, setEndDate] = useState(initial.endDate)
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const runAnalysis = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const payload = toMoodAnalysisPayload({ startDate, endDate })
      const response = await aiApi.moodAnalysis(payload)
      const mapped = mapMoodAnalysisFromApi(response?.data)
      if (!mapped?.summary && !mapped?.overallMood) {
        setAnalysis(null)
        setError('No analysis was returned. Try again.')
      } else {
        setAnalysis(mapped)
      }
    } catch (err) {
      setAnalysis(null)
      setError(err?.message || 'Unable to analyse journal mood.')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, loading])

  return (
    <section
      className="journal-mood-analysis card"
      aria-labelledby="journal-mood-analysis-heading"
    >
      <div className="journal-mood-analysis__head">
        <div>
          <h2 id="journal-mood-analysis-heading">
            <Brain size={18} aria-hidden="true" /> Mood & Motivation
          </h2>
          <p>Reflect on journal patterns for a chosen date range.</p>
        </div>
      </div>

      <div className="journal-mood-analysis__controls">
        <label>
          From
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={loading}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={loading}
          />
        </label>
        <button
          type="button"
          className="btn-primary"
          onClick={runAnalysis}
          disabled={loading}
        >
          {loading
            ? 'Analyzing…'
            : analysis
              ? 'Re-analyze'
              : 'Analyze My Journal'}
        </button>
        {analysis && (
          <button
            type="button"
            className="btn-secondary"
            onClick={runAnalysis}
            disabled={loading}
            aria-label="Re-analyze journal"
          >
            <RefreshCw size={16} />
          </button>
        )}
      </div>

      {error && (
        <div className="journal-mood-analysis__banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={runAnalysis}
            disabled={loading}
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="journal-mood-analysis__loading" aria-busy="true">
          Analyzing your journal… This can take up to about 90 seconds. Please
          keep this page open.
        </div>
      )}

      {!loading && !error && !analysis && (
        <EmptyState
          title="No analysis yet"
          description="Choose a date range with at least three journal entries, then select Analyze My Journal. Analysis does not run automatically."
        />
      )}

      {analysis && (
        <div className="journal-mood-analysis__result" aria-busy={loading || undefined}>
          <p className="journal-mood-analysis__meta">
            {analysis.entriesAnalyzed} entries · {analysis.analysisPeriod.startDate} →{' '}
            {analysis.analysisPeriod.endDate}
          </p>
          <h3>{analysis.overallMood}</h3>
          {analysis.moodSummary && <p>{analysis.moodSummary}</p>}
          {analysis.summary && (
            <p className="journal-mood-analysis__summary">{analysis.summary}</p>
          )}

          <div className="journal-mood-analysis__grid">
            <ListBlock title="Positive patterns" items={analysis.moodPatterns.positive} />
            <ListBlock
              title="Challenging patterns"
              items={analysis.moodPatterns.challenging}
            />
            <ListBlock title="Motivation" items={analysis.motivationPatterns} />
            <ListBlock title="Positive observations" items={analysis.positiveObservations} />
            <ListBlock title="Areas to improve" items={analysis.areasToImprove} />
            <ListBlock title="Recommendations" items={analysis.recommendations} />
          </div>
        </div>
      )}
    </section>
  )
}

function ListBlock({ title, items }) {
  if (!items?.length) return null
  return (
    <div className="journal-mood-analysis__block">
      <h4>{title}</h4>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

export default JournalMoodAnalysis
