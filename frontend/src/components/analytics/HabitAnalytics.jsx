import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Search } from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import { analyticsApi } from '../../services/api/analyticsApi'
import { mapHabitAnalyticsFromApi } from '../../services/api/analyticsMappers'
import { toDateKey } from '../../utils/dateUtils'
import { getHabitIcon } from '../habits/habitIcons'
import EmptyState from '../common/EmptyState'
import './HabitAnalytics.css'

function HabitAnalytics({ habits, range }) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(habits[0]?.id || null)
  const [stats, setStats] = useState(mapHabitAnalyticsFromApi(null))
  const [loading, setLoading] = useState(false)
  const { calendarTick } = useHabits()
  const genRef = useRef(0)

  useEffect(() => {
    if (!habits.some((h) => h.id === selectedId)) {
      setSelectedId(habits[0]?.id || null)
    }
  }, [habits, selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return habits
    return habits.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.category || '').toLowerCase().includes(q)
    )
  }, [habits, query])

  const selected = habits.find((h) => h.id === selectedId) || null
  const startKey = range?.start ? toDateKey(range.start) : null
  const endKey = range?.end ? toDateKey(range.end) : null

  useEffect(() => {
    if (!selectedId || !startKey || !endKey) {
      setStats(mapHabitAnalyticsFromApi(null))
      return
    }
    const generation = ++genRef.current
    let cancelled = false
    setLoading(true)
    analyticsApi
      .habit(selectedId, { start_date: startKey, end_date: endKey })
      .then((res) => {
        if (cancelled || generation !== genRef.current) return
        setStats(mapHabitAnalyticsFromApi(res?.data))
      })
      .catch(() => {
        if (cancelled || generation !== genRef.current) return
        setStats(mapHabitAnalyticsFromApi(null))
      })
      .finally(() => {
        if (!cancelled && generation === genRef.current) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, startKey, endKey, calendarTick])

  if (!habits.length) {
    return (
      <EmptyState
        title="No habits yet"
        description="Create habits on the Habits page to analyze individual performance."
      />
    )
  }

  const Icon = selected ? getHabitIcon(selected.icon) : null

  return (
    <div className="habit-analytics">
      <aside className="habit-analytics__list card">
        <label className="habit-analytics__search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search habits..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <ul>
          {filtered.map((habit) => {
            const HabitIcon = getHabitIcon(habit.icon)
            return (
              <li key={habit.id}>
                <button
                  type="button"
                  className={habit.id === selectedId ? 'is-active' : ''}
                  onClick={() => setSelectedId(habit.id)}
                >
                  <span className="habit-analytics__avatar" aria-hidden="true">
                    <HabitIcon size={16} />
                  </span>
                  <span>
                    <strong>{habit.name}</strong>
                    <em>{habit.category}</em>
                  </span>
                </button>
              </li>
            )
          })}
          {!filtered.length && (
            <li className="habit-analytics__empty">No matching habits.</li>
          )}
        </ul>
      </aside>

      <section className="habit-analytics__detail card" aria-busy={loading || undefined}>
        {!selected ? (
          <EmptyState
            title="Select a habit"
            description="Pick a habit from the list to see detailed analytics."
          />
        ) : (
          <>
            <div className="habit-analytics__title">
              <span className="habit-analytics__avatar is-lg" aria-hidden="true">
                {Icon && <Icon size={22} />}
              </span>
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selected.category} · {selected.frequency}
                </p>
              </div>
            </div>

            <div className="habit-analytics__kpis">
              <article>
                <span>Scheduled</span>
                <strong>{stats.scheduled}</strong>
              </article>
              <article>
                <span>Completed</span>
                <strong>{stats.completed}</strong>
              </article>
              <article>
                <span>Missed</span>
                <strong>{stats.missed}</strong>
              </article>
              <article>
                <span>Rate</span>
                <strong>{stats.rate}%</strong>
              </article>
              <article>
                <span>Current streak</span>
                <strong>{stats.currentStreak}</strong>
              </article>
              <article>
                <span>Longest streak</span>
                <strong>{stats.longestStreak}</strong>
              </article>
            </div>

            <div className="habit-analytics__spark">
              <h3>Completion over range</h3>
              {!stats.trend.length ? (
                <EmptyState
                  title="No scheduled days"
                  description="This habit wasn’t scheduled in the selected range."
                />
              ) : (
                <div className="habit-analytics__chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trend}>
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        minTickGap={24}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                      />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip
                        formatter={(value) => [
                          value === 100 ? 'Completed' : 'Missed',
                          'Status',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#1463F3"
                        fill="rgba(20,99,243,0.15)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export default HabitAnalytics
