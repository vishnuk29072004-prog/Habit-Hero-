import { JOURNAL_MOODS, JOURNAL_TAGS } from '../../utils/journalCalculations'
import './JournalFilters.css'

function JournalFilters({
  filters,
  habits,
  onChange,
}) {
  const update = (key, value) => onChange({ ...filters, [key]: value })

  return (
    <div className="journal-filters">
      <label className="journal-filters__search">
        <span className="sr-only">Search journal</span>
        <input
          type="search"
          placeholder="Search title, note, or habit..."
          value={filters.query}
          onChange={(e) => update('query', e.target.value)}
        />
      </label>

      <div className="journal-filters__row">
        <label>
          From
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => update('startDate', e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => update('endDate', e.target.value)}
          />
        </label>
        <label>
          Habit
          <select
            value={filters.habitId}
            onChange={(e) => update('habitId', e.target.value)}
          >
            <option value="all">All habits</option>
            <option value="general">General only</option>
            {habits
              .filter((h) => !h.archived)
              .map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Mood
          <select
            value={filters.mood}
            onChange={(e) => update('mood', e.target.value)}
          >
            <option value="all">All moods</option>
            {JOURNAL_MOODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <select
            value={filters.tag}
            onChange={(e) => update('tag', e.target.value)}
          >
            <option value="all">All tags</option>
            {JOURNAL_TAGS.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select
            value={filters.sort}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
        </label>
      </div>
    </div>
  )
}

export default JournalFilters
