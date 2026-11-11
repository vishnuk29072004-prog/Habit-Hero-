import { useCallback, useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import Modal from '../common/Modal'
import EmptyState from '../common/EmptyState'
import JournalFilters from './JournalFilters'
import { resolveEntryHabit } from '../../utils/journalCalculations'
import './JournalHistory.css'

const DEFAULT_FILTERS = {
  query: '',
  habitId: 'all',
  mood: 'all',
  tag: 'all',
  startDate: '',
  endDate: '',
  sort: 'newest',
}

const PAGE_SIZE = 20

function JournalHistory({
  open,
  habits,
  searchJournalEntries,
  onClose,
  onSelectEntryDate,
  onEdit,
}) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const requestGenRef = useRef(0)
  const debounceRef = useRef(null)

  const runSearch = useCallback(
    async (nextFilters, nextPage) => {
      if (!searchJournalEntries) return
      const generation = ++requestGenRef.current
      setLoading(true)
      setError(null)
      try {
        const result = await searchJournalEntries(
          nextFilters,
          nextPage,
          PAGE_SIZE
        )
        if (generation !== requestGenRef.current) return
        setItems(result.items || [])
        setTotal(result.total || 0)
        setPage(result.page || nextPage)
      } catch (err) {
        if (generation !== requestGenRef.current) return
        setItems([])
        setTotal(0)
        setError(err?.message || 'Unable to search journal entries.')
      } finally {
        if (generation === requestGenRef.current) setLoading(false)
      }
    },
    [searchJournalEntries]
  )

  useEffect(() => {
    if (!open) return undefined
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      runSearch(filters, page)
    }, 250)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [open, filters, page, runSearch])

  useEffect(() => {
    if (!open) {
      setFilters(DEFAULT_FILTERS)
      setPage(1)
      setItems([])
      setTotal(0)
      setError(null)
      requestGenRef.current += 1
    }
  }, [open])

  const handleFiltersChange = (next) => {
    setFilters(next)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  if (!open) return null

  return (
    <Modal title="Journal History" onClose={onClose} wide>
      <div className="journal-history">
        <JournalFilters
          filters={filters}
          habits={habits}
          onChange={handleFiltersChange}
        />

        {error && (
          <p className="journal-history__error" role="alert">
            {error}
          </p>
        )}

        {loading && !items.length ? (
          <EmptyState
            title="Loading entries…"
            description="Fetching journal history from the server."
          />
        ) : !items.length ? (
          <EmptyState
            title="No matching entries"
            description="Try adjusting your search or filters."
          />
        ) : (
          <ul className="journal-history__list" aria-busy={loading || undefined}>
            {items.map((entry) => {
              const resolved = resolveEntryHabit(entry, habits)
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    className="journal-history__item"
                    onClick={() => {
                      onSelectEntryDate(entry.date)
                      onClose()
                    }}
                  >
                    <div>
                      <strong>{resolved.name}</strong>
                      <p>{entry.content}</p>
                      <em>
                        {format(parseISO(entry.date), 'MMM d, yyyy')} ·{' '}
                        {entry.mood}
                      </em>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="journal-history__edit"
                    onClick={() => onEdit(entry)}
                  >
                    Edit
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="journal-history__pager">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages} · {total} entries
            </span>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default JournalHistory
