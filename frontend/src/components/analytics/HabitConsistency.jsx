import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, format, startOfMonth, subMonths } from 'date-fns'
import { useHabits } from '../../context/HabitContext'
import { calendarApi } from '../../services/api/calendarApi'
import { mapHeatmapFromMonthlyDays } from '../../services/api/analyticsMappers'
import './HabitConsistency.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function HabitConsistency({ onSelectDate, initialMonth }) {
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(initialMonth || new Date())
  )
  const [tip, setTip] = useState(null)
  const [monthlyDays, setMonthlyDays] = useState([])
  const { calendarTick } = useHabits()
  const genRef = useRef(0)

  const month = viewMonth.getMonth() + 1
  const year = viewMonth.getFullYear()

  useEffect(() => {
    const generation = ++genRef.current
    let cancelled = false
    calendarApi
      .monthly({ month, year })
      .then((res) => {
        if (cancelled || generation !== genRef.current) return
        setMonthlyDays(res?.data?.days || [])
      })
      .catch(() => {
        if (cancelled || generation !== genRef.current) return
        setMonthlyDays([])
      })
    return () => {
      cancelled = true
    }
  }, [month, year, calendarTick])

  const cells = useMemo(
    () => mapHeatmapFromMonthlyDays(monthlyDays, viewMonth),
    [monthlyDays, viewMonth]
  )

  return (
    <section className="habit-consistency card">
      <div className="habit-consistency__head">
        <div>
          <h2>Habit Consistency</h2>
          <p>Daily completion heatmap for the month.</p>
        </div>
        <div className="habit-consistency__nav">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setViewMonth((m) => startOfMonth(subMonths(m, 1)))}
          >
            <ChevronLeft size={18} />
          </button>
          <strong>{format(viewMonth, 'MMMM yyyy')}</strong>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setViewMonth((m) => startOfMonth(addMonths(m, 1)))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="habit-consistency__weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="habit-consistency__grid">
        {cells.map((cell) => (
          <button
            key={cell.dateKey}
            type="button"
            className={`habit-consistency__cell bucket-${cell.bucket} ${
              cell.inMonth ? '' : 'is-outside'
            }`}
            disabled={!cell.inMonth}
            onClick={() => cell.inMonth && onSelectDate?.(cell.date)}
            onMouseEnter={(e) => {
              if (!cell.inMonth) return
              setTip({
                x: e.clientX,
                y: e.clientY,
                label: format(cell.date, 'MMM d'),
                rate: cell.rate,
                completed: cell.completed,
                scheduled: cell.scheduled,
              })
            }}
            onMouseLeave={() => setTip(null)}
            aria-label={
              cell.inMonth
                ? `${format(cell.date, 'MMM d')}: ${cell.rate}%`
                : undefined
            }
          >
            {cell.inMonth ? cell.dayNumber : ''}
          </button>
        ))}
      </div>

      <ul className="habit-consistency__legend" aria-label="Heatmap legend">
        <li>
          <span className="bucket-100" /> 100%
        </li>
        <li>
          <span className="bucket-75" /> 75%+
        </li>
        <li>
          <span className="bucket-25" /> 25%+
        </li>
        <li>
          <span className="bucket-0" /> Missed
        </li>
        <li>
          <span className="bucket-none" /> None
        </li>
      </ul>

      {tip && (
        <div
          className="habit-consistency__tooltip"
          style={{ left: tip.x, top: tip.y }}
        >
          <strong>{tip.label}</strong>
          <span>
            {tip.completed}/{tip.scheduled} · {tip.rate}%
          </span>
        </div>
      )}
    </section>
  )
}

export default HabitConsistency
