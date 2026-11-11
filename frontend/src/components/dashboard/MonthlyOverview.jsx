import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import {
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Flame,
  Percent,
} from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import { useMonthlyAnalytics } from '../../hooks/useDashboardAnalytics'
import { getCalendarDayKind } from '../../utils/dateUtils'
import './MonthlyOverview.css'

function MonthlyOverview() {
  const { selectedDate, setSelectedDate } = useHabits()
  const [currentMonth, setCurrentMonth] = useState(() =>
    startOfMonth(selectedDate || new Date())
  )
  const { stats: monthlyStats } = useMonthlyAnalytics(currentMonth)

  useEffect(() => {
    setCurrentMonth(startOfMonth(selectedDate))
  }, [selectedDate])

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  return (
    <section className="monthly-overview card">
      <div className="monthly-overview__header">
        <h2>Monthly Overview</h2>
        <div className="monthly-overview__nav">
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span>{format(currentMonth, 'MMMM yyyy')}</span>
          <button
            type="button"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="monthly-overview__body">
        <div className="monthly-overview__calendar">
          <div className="monthly-overview__weekdays">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <span key={`${day}-${index}`}>{day}</span>
            ))}
          </div>
          <div className="monthly-overview__grid">
            {calendarDays.map((day) => {
              const inMonth = isSameMonth(day, currentMonth)
              const kind = inMonth ? getCalendarDayKind(day) : null
              const selected =
                format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
              const className = [
                'monthly-overview__day',
                inMonth ? kind : 'outside',
                selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={className}
                  disabled={!inMonth}
                  onClick={() => inMonth && setSelectedDate(day)}
                  aria-label={format(day, 'MMM d, yyyy')}
                  aria-current={selected ? 'date' : undefined}
                >
                  {inMonth ? day.getDate() : ''}
                </button>
              )
            })}
          </div>

          <ul className="monthly-overview__legend" aria-label="Calendar legend">
            <li>
              <span className="swatch today" /> Yellow – Today
            </li>
            <li>
              <span className="swatch past" /> Light Blue – Past Days
            </li>
            <li>
              <span className="swatch future" /> Blue – Upcoming Days
            </li>
          </ul>
        </div>

        <ul className="monthly-overview__stats">
          <li>
            <div className="monthly-overview__stat-icon blue">
              <CalendarCheck2 size={16} />
            </div>
            <div>
              <strong>{monthlyStats.daysCompleted} Days Completed</strong>
            </div>
          </li>
          <li>
            <div className="monthly-overview__stat-icon blue">
              <Percent size={16} />
            </div>
            <div>
              <strong>{monthlyStats.monthlyRate}% Monthly Rate</strong>
            </div>
          </li>
          <li>
            <div className="monthly-overview__stat-icon red">
              <Flame size={16} />
            </div>
            <div>
              <strong>{monthlyStats.longestStreak} Longest Streak</strong>
            </div>
          </li>
        </ul>
      </div>
    </section>
  )
}

export default MonthlyOverview
