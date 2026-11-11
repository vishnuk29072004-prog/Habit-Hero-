import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import { useHabits } from '../../context/HabitContext'
import './Progress.css'

function Progress() {
  const {
    activeHabits,
    selectedDate,
    getDayCompletionRate,
    setSelectedDate,
  } = useHabits()

  const history = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const date = subDays(selectedDate, index)
      const key = format(date, 'yyyy-MM-dd')
      const scheduled = activeHabits.filter((h) => {
        if (h.archived) return false
        if (h.startDate && key < h.startDate) return false
        return true
      })
      return {
        date,
        key,
        rate: getDayCompletionRate(date),
        completed: scheduled.filter((h) => h.checkins?.[key]?.completed).length,
        total: scheduled.length,
      }
    })
  }, [activeHabits, selectedDate, getDayCompletionRate])

  return (
    <div className="progress-page">
      <header>
        <h1>Progress</h1>
        <p>Detailed habit completion history around the selected date.</p>
      </header>

      <ul className="progress-page__list">
        {history.map((item) => (
          <li key={item.key} className="card">
            <div>
              <strong>{format(item.date, 'EEE, MMM d, yyyy')}</strong>
              <span>
                {item.completed} / {item.total} habits · {item.rate}%
              </span>
            </div>
            <button type="button" onClick={() => setSelectedDate(item.date)}>
              View day
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Progress
