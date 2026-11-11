import { getHabitIcon } from '../habits/habitIcons'
import EmptyState from '../common/EmptyState'
import './TopPerformingHabits.css'

function TopPerformingHabits({ habits }) {
  return (
    <section className="top-habits card">
      <div className="top-habits__head">
        <h2>Top Performing Habits</h2>
        <p>Highest completion rates in this range.</p>
      </div>

      {!habits.length ? (
        <EmptyState
          title="No habit data"
          description="Complete scheduled habits to see top performers."
        />
      ) : (
        <ul className="top-habits__list">
          {habits.map((habit) => {
            const Icon = getHabitIcon(habit.icon)
            return (
              <li key={habit.id}>
                <div className="top-habits__icon" aria-hidden="true">
                  <Icon size={18} />
                </div>
                <div className="top-habits__meta">
                  <div className="top-habits__row">
                    <strong>{habit.name}</strong>
                    <span>{habit.rate}%</span>
                  </div>
                  <div className="top-habits__bar" aria-hidden="true">
                    <i style={{ width: `${habit.rate}%` }} />
                  </div>
                  <small>
                    {habit.completed}/{habit.scheduled} completed
                  </small>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export default TopPerformingHabits
