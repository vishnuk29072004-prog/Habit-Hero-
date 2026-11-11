import { useMemo } from 'react'
import {
  addMonths,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getMonthlyCalendarDays } from '../../utils/calendarCalculations'
import { mapDaySummaryToUiStatus } from '../../services/api/calendarMappers'
import { toDateKey } from '../../utils/dateUtils'
import CalendarDay from './CalendarDay'
import './MonthlyCalendar.css'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function MonthlyCalendar({
  viewMonth,
  onViewMonthChange,
  selectedDate,
  onSelectDate,
  daySummariesByDate = {},
  loading = false,
}) {
  const today = startOfDay(new Date())
  const days = useMemo(() => getMonthlyCalendarDays(viewMonth), [viewMonth])

  const goToday = () => {
    onSelectDate(today)
    onViewMonthChange(startOfMonth(today))
  }

  return (
    <section className="monthly-calendar card">
      <div className="monthly-calendar__header">
        <div className="monthly-calendar__nav">
          <button
            type="button"
            onClick={() => onViewMonthChange(subMonths(viewMonth, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <h2>{format(viewMonth, 'MMMM yyyy')}</h2>
          <button
            type="button"
            onClick={() => onViewMonthChange(addMonths(viewMonth, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <button type="button" className="monthly-calendar__today" onClick={goToday}>
          Today
        </button>
      </div>

      <div className="monthly-calendar__weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div
        className={`monthly-calendar__grid${loading ? ' is-loading' : ''}`}
        aria-busy={loading || undefined}
      >
        {days.map((item) => {
          const summary = daySummariesByDate[toDateKey(item.date)]
          const status = mapDaySummaryToUiStatus(
            summary,
            item.date,
            today,
            item.inMonth
          )
          return (
            <CalendarDay
              key={item.dateKey}
              date={item.date}
              dayNumber={item.dayNumber}
              inMonth={item.inMonth}
              status={status}
              selected={isSameDay(item.date, selectedDate)}
              onSelect={onSelectDate}
            />
          )
        })}
      </div>
    </section>
  )
}

export default MonthlyCalendar
