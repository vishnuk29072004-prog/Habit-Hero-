import { useEffect, useMemo, useState } from 'react'
import { addMonths, format, startOfMonth, subMonths } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getJournalCalendarDays } from '../../utils/journalCalculations'
import './JournalCalendar.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function JournalCalendar({ entries, selectedDate, onSelectDate }) {
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selectedDate || new Date())
  )

  useEffect(() => {
    setViewMonth(startOfMonth(selectedDate))
  }, [selectedDate])

  const cells = useMemo(
    () => getJournalCalendarDays(viewMonth, entries, selectedDate),
    [viewMonth, entries, selectedDate]
  )

  return (
    <section className="journal-calendar card">
      <div className="journal-calendar__head">
        <h2>Journal Calendar</h2>
        <div className="journal-calendar__nav">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => startOfMonth(subMonths(m, 1)))}
          >
            <ChevronLeft size={16} />
          </button>
          <strong>{format(viewMonth, 'MMM yyyy')}</strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => startOfMonth(addMonths(m, 1)))}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="journal-calendar__weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="journal-calendar__grid">
        {cells.map((cell) => (
          <button
            key={cell.dateKey}
            type="button"
            className={[
              'journal-calendar__day',
              cell.inMonth ? '' : 'is-outside',
              cell.isSelected ? 'is-selected' : '',
              cell.isFuture ? 'is-future' : '',
              cell.hasEntries ? 'has-entries' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onSelectDate(cell.date)}
            aria-label={format(cell.date, 'MMM d, yyyy')}
            aria-current={cell.isSelected ? 'date' : undefined}
          >
            <span>{cell.dayNumber}</span>
            {cell.hasEntries && cell.inMonth && <i />}
          </button>
        ))}
      </div>
    </section>
  )
}

export default JournalCalendar
