import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { useHabits } from '../../context/HabitContext'
import { getCategoryDistribution } from '../../utils/habitCalculations'
import EmptyState from '../common/EmptyState'
import './HabitCategoryDonut.css'

function HabitCategoryDonut() {
  const { habits } = useHabits()
  const data = useMemo(() => getCategoryDistribution(habits), [habits])
  const total = useMemo(
    () => habits.filter((habit) => !habit.archived).length,
    [habits]
  )

  return (
    <section className="habit-category-donut card">
      <div className="habit-category-donut__header">
        <h2>Habit Categories</h2>
      </div>

      {!data.length ? (
        <EmptyState
          title="No habits yet"
          description="Create habits to see category distribution."
        />
      ) : (
        <div className="habit-category-donut__content">
          <div className="habit-category-donut__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="habit-category-donut__center">
              <strong>{total}</strong>
              <span>Habits</span>
            </div>
          </div>

          <ul className="habit-category-donut__legend">
            {data.map((item) => (
              <li key={item.name}>
                <span
                  className="habit-category-donut__dot"
                  style={{ background: item.color }}
                />
                <span className="habit-category-donut__label">{item.name}</span>
                <span className="habit-category-donut__value">{item.value}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

export default HabitCategoryDonut
