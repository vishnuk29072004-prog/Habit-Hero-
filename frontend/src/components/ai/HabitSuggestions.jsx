import { useCallback, useState } from 'react'
import { Sparkles, RefreshCw, Plus } from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import { aiApi } from '../../services/api/aiApi'
import {
  mapHabitSuggestionsResponse,
  suggestionToHabitPayload,
} from '../../services/api/aiMappers'
import EmptyState from '../common/EmptyState'
import './HabitSuggestions.css'

function HabitSuggestions() {
  const { addHabit, habits } = useHabits()
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState('')
  const [addingKey, setAddingKey] = useState(null)
  const [addedKeys, setAddedKeys] = useState(() => new Set())

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2000)
  }

  const suggestionKey = (item) =>
    `${(item.name || '').toLowerCase()}::${item.recommendedStartDate || ''}`

  const loadSuggestions = useCallback(async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const response = await aiApi.habitSuggestions({ count: 5 })
      const mapped = mapHabitSuggestionsResponse(response?.data)
      setSuggestions(mapped.suggestions)
      setAddedKeys(new Set())
      if (!mapped.suggestions.length) {
        setError('No suggestions were returned. Try again.')
      }
    } catch (err) {
      setSuggestions([])
      setError(err?.message || 'Unable to generate habit suggestions.')
    } finally {
      setLoading(false)
    }
  }, [loading])

  const handleAdd = async (item) => {
    const key = suggestionKey(item)
    if (addingKey || addedKeys.has(key)) return

    const exists = (habits || []).some(
      (h) =>
        !h.archived &&
        (h.name || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase()
    )
    if (exists) {
      showToast('You already have this habit')
      setAddedKeys((prev) => new Set(prev).add(key))
      return
    }

    setAddingKey(key)
    try {
      await addHabit(suggestionToHabitPayload(item))
      setAddedKeys((prev) => new Set(prev).add(key))
      showToast('Habit added')
    } catch (err) {
      window.alert(err?.message || 'Unable to add habit.')
    } finally {
      setAddingKey(null)
    }
  }

  return (
    <section className="habit-suggestions card" aria-labelledby="habit-suggestions-heading">
      <div className="habit-suggestions__head">
        <div>
          <h2 id="habit-suggestions-heading">
            <Sparkles size={18} aria-hidden="true" /> AI Habit Coach
          </h2>
          <p>Get five personalized habits based on your goals and routines.</p>
        </div>
        <div className="habit-suggestions__actions">
          <button
            type="button"
            className="btn-primary"
            onClick={loadSuggestions}
            disabled={loading}
          >
            {loading
              ? 'Generating…'
              : suggestions.length
                ? 'Regenerate'
                : 'Generate Suggestions'}
          </button>
          {suggestions.length > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={loadSuggestions}
              disabled={loading}
              aria-label="Regenerate suggestions"
            >
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="habit-suggestions__banner" role="alert">
          <span>{error}</span>
          <button type="button" className="btn-secondary" onClick={loadSuggestions} disabled={loading}>
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="habit-suggestions__loading" aria-busy="true">
          Generating personalized habits… This can take up to about 90 seconds.
          Please keep this page open.
        </div>
      )}

      {!loading && !error && !suggestions.length && (
        <EmptyState
          title="No suggestions yet"
          description="Generate AI habit suggestions tailored to your current habits and goals. Nothing runs until you ask."
        />
      )}

      {suggestions.length > 0 && (
        <ul className="habit-suggestions__list" aria-busy={loading || undefined}>
          {suggestions.map((item) => {
            const key = suggestionKey(item)
            const added = addedKeys.has(key)
            return (
              <li key={key} className="habit-suggestions__item">
                <div className="habit-suggestions__item-main">
                  <div className="habit-suggestions__item-top">
                    <h3>{item.name}</h3>
                    <div className="habit-suggestions__badges">
                      <span>{item.category}</span>
                      <span>{item.frequency}</span>
                    </div>
                  </div>
                  <p className="habit-suggestions__desc">{item.description}</p>
                  {item.reason && (
                    <p className="habit-suggestions__reason">
                      <strong>Why:</strong> {item.reason}
                    </p>
                  )}
                  {item.recommendedStartDate && (
                    <p className="habit-suggestions__date">
                      Start: {item.recommendedStartDate}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={added || addingKey === key || loading}
                  onClick={() => handleAdd(item)}
                >
                  <Plus size={16} />
                  {added ? 'Added' : addingKey === key ? 'Adding…' : 'Add Habit'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {toast && <div className="habit-suggestions__toast">{toast}</div>}
    </section>
  )
}

export default HabitSuggestions
