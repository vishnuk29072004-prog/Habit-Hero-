import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './DatePicker.css'

function DatePicker({
  selectedDate,
  onSelect,
  onPrevDay,
  onNextDay,
}) {
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate))

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 0 }),
      end: endOfWeek(monthEnd, { weekStartsOn: 0 }),
    })
  }, [viewMonth])

  return (
    <div className="date-picker">
      <div className="date-picker__toolbar">
        <button type="button" onClick={onPrevDay} aria-label="Previous day">
          <ChevronLeft size={16} />
        </button>
        <span>{format(selectedDate, 'MMM d, yyyy')}</span>
        <button type="button" onClick={onNextDay} aria-label="Next day">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="date-picker__month-nav">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <strong>{format(viewMonth, 'MMMM yyyy')}</strong>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="date-picker__weekdays">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="date-picker__grid">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth)
          const selected = isSameDay(day, selectedDate)
          const today = isSameDay(day, new Date())
          return (
            <button
              key={day.toISOString()}
              type="button"
              className={[
                'date-picker__day',
                inMonth ? '' : 'is-outside',
                selected ? 'is-selected' : '',
                today ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelect(day)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        className="date-picker__today"
        onClick={() => onSelect(new Date())}
      >
        Jump to today
      </button>
    </div>
  )
}

export default DatePicker
