import { Check } from 'lucide-react'
import { format } from 'date-fns'
import './CalendarDay.css'

function CalendarDay({
  date,
  dayNumber,
  inMonth,
  status,
  selected,
  onSelect,
}) {
  const className = [
    'calendar-day',
    `is-${status}`,
    selected ? 'is-selected' : '',
    !inMonth ? 'is-outside' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      disabled={!inMonth}
      onClick={() => inMonth && onSelect(date)}
      aria-label={format(date, 'MMM d, yyyy')}
      aria-current={selected ? 'date' : undefined}
    >
      <span className="calendar-day__num">{inMonth ? dayNumber : dayNumber}</span>
      {inMonth && status === 'completed' && (
        <span className="calendar-day__mark is-check" aria-hidden="true">
          <Check size={12} strokeWidth={3} />
        </span>
      )}
      {inMonth && status === 'partial' && (
        <span className="calendar-day__mark is-partial" aria-hidden="true" />
      )}
      {inMonth && status === 'today' && (
        <span className="calendar-day__today-dot" aria-hidden="true" />
      )}
    </button>
  )
}

export default CalendarDay
