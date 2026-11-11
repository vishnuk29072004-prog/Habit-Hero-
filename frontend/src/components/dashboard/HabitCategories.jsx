import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import EmptyState from '../common/EmptyState'
import './HabitCategories.css'

function HabitCategories({ categoryStats = [], totalCount = 0 }) {
  return (
    <section className="habit-categories card">
      <div className="habit-categories__header">
        <h2>Habit Categories</h2>
      </div>

      {!categoryStats.length ? (
        <EmptyState
          title="No scheduled habits"
          description="Add habits for this date to see category analytics."
        />
      ) : (
        <div className="habit-categories__content">
          <div className="habit-categories__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryStats}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {categoryStats.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="habit-categories__center">
              <strong>{totalCount}</strong>
              <span>Habits</span>
            </div>
          </div>

          <ul className="habit-categories__legend">
            {categoryStats.map((item) => (
              <li key={item.name}>
                <span
                  className="habit-categories__dot"
                  style={{ background: item.color }}
                />
                <span className="habit-categories__label">{item.name}</span>
                <span className="habit-categories__value">{item.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default HabitCategories
