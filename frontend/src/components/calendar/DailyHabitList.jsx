import { Check, Hourglass } from 'lucide-react'
import { getHabitIcon } from '../habits/habitIcons'
import EmptyState from '../common/EmptyState'
import './DailyHabitList.css'

function DailyHabitList({ habits, isFuture, onToggle }) {
  if (!habits.length) {
    return (
      <EmptyState
        title="No habits scheduled"
        description="Nothing is scheduled for this date."
      />
    )
  }

  return (
    <ul className="daily-habit-list">
      {habits.map((habit) => {
        const Icon = getHabitIcon(habit.icon)
        const status = isFuture
          ? 'upcoming'
          : habit.completed
            ? 'completed'
            : 'pending'

        return (
          <li key={habit.id} className="daily-habit-list__item">
            <button
              type="button"
              className={`daily-habit-list__check ${habit.completed ? 'is-done' : ''}`}
              onClick={() => onToggle(habit.id)}
              disabled={isFuture}
              aria-label={
                habit.completed
                  ? `Mark ${habit.name} as incomplete`
                  : `Mark ${habit.name} as complete`
              }
            >
              {habit.completed && <Check size={14} strokeWidth={3} />}
            </button>

            <span className="daily-habit-list__icon">
              <Icon size={18} />
            </span>

            <div className="daily-habit-list__body">
              <strong>{habit.name}</strong>
              <span className={`daily-habit-list__badge is-${status}`}>
                {status === 'completed' && 'Completed'}
                {status === 'pending' && (
                  <>
                    <Hourglass size={12} />
                    Pending
                  </>
                )}
                {status === 'upcoming' && 'Upcoming'}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default DailyHabitList
