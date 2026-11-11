import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getHabitIcon } from '../habits/habitIcons'
import EmptyState from '../common/EmptyState'
import './CategoryAnalytics.css'

function CategoryAnalytics({ categories = [], habits = [], bestDays = [] }) {
  const [selected, setSelected] = useState(categories[0]?.name || null)

  useEffect(() => {
    if (!categories.some((c) => c.name === selected)) {
      setSelected(categories[0]?.name || null)
    }
  }, [categories, selected])

  const activeName =
    categories.find((c) => c.name === selected)?.name ||
    categories[0]?.name ||
    null

  const ranked = useMemo(
    () => [...categories].sort((a, b) => b.rate - a.rate),
    [categories]
  )
  const best = ranked[0] || null
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null

  const members = useMemo(() => {
    if (!activeName) return []
    return habits.filter((h) => !h.archived && h.category === activeName)
  }, [habits, activeName])

  if (!categories.length) {
    return (
      <EmptyState
        title="No category data"
        description="Schedule habits in this range to compare categories."
      />
    )
  }

  return (
    <div className="category-analytics">
      <div className="category-analytics__summary">
        <article className="card">
          <span>Best category</span>
          <strong>{best?.name || '—'}</strong>
          <em>{best ? `${best.rate}% completion` : ''}</em>
        </article>
        <article className="card">
          <span>Needs focus</span>
          <strong>{worst && worst.name !== best?.name ? worst.name : '—'}</strong>
          <em>
            {worst && worst.name !== best?.name
              ? `${worst.rate}% completion`
              : 'All categories performing similarly'}
          </em>
        </article>
        <article className="card">
          <span>Active categories</span>
          <strong>{categories.length}</strong>
          <em>With scheduled habits in range</em>
        </article>
        {bestDays[0] && (
          <article className="card">
            <span>Best weekday</span>
            <strong>{bestDays[0].weekday}</strong>
            <em>{bestDays[0].rate}% completion</em>
          </article>
        )}
      </div>

      <div className="category-analytics__mid">
        <section className="card category-analytics__bars">
          <h2>Category comparison</h2>
          <div className="category-analytics__chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categories}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                <Bar dataKey="rate" radius={[8, 8, 0, 0]}>
                  {categories.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card category-analytics__donut">
          <h2>Share of completions</h2>
          <div className="category-analytics__pie">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categories}
                  dataKey="completed"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="85%"
                  paddingAngle={3}
                  stroke="none"
                >
                  {categories.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul>
            {categories.map((item) => (
              <li key={item.name}>
                <button
                  type="button"
                  className={item.name === activeName ? 'is-active' : ''}
                  onClick={() => setSelected(item.name)}
                >
                  <span style={{ background: item.color }} />
                  {item.name}
                  <strong>{item.rate}%</strong>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card category-analytics__members">
        <h2>Habits in {activeName}</h2>
        {!members.length ? (
          <EmptyState
            title="No habits"
            description="No active habits in this category."
          />
        ) : (
          <ul>
            {members.map((habit) => {
              const Icon = getHabitIcon(habit.icon)
              return (
                <li key={habit.id}>
                  <span className="category-analytics__icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{habit.name}</strong>
                    <em>{habit.frequency}</em>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default CategoryAnalytics
