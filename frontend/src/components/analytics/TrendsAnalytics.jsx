import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../common/EmptyState'
import './TrendsAnalytics.css'

function TrendsAnalytics({
  daily = [],
  weekly = [],
  monthly = [],
  period = { rate: 0, completed: 0, scheduled: 0 },
  streakDays = 0,
  longestStreak = 0,
  bestDays = [],
  streaks = null,
}) {
  const hasData = (period.scheduled || 0) > 0 || daily.some((d) => d.scheduled > 0)

  if (!hasData) {
    return (
      <EmptyState
        title="No trend data"
        description="Complete scheduled habits in this range to unlock trend charts."
      />
    )
  }

  const bestHabit = streaks?.best_performing_habit

  return (
    <div className="trends-analytics">
      <div className="trends-analytics__context">
        <article className="card">
          <span>Range completion</span>
          <strong>{period.rate}%</strong>
          <em>
            {period.completed}/{period.scheduled} occurrences
          </em>
        </article>
        <article className="card">
          <span>Current streak</span>
          <strong>{streakDays} days</strong>
          <em>Active consecutive success days</em>
        </article>
        <article className="card">
          <span>Longest streak</span>
          <strong>{longestStreak} days</strong>
          <em>Best run in your history</em>
        </article>
        {bestDays[0] && (
          <article className="card">
            <span>Best weekday</span>
            <strong>{bestDays[0].weekday}</strong>
            <em>{bestDays[0].rate}% completion</em>
          </article>
        )}
        {bestHabit && (
          <article className="card">
            <span>Best habit streak</span>
            <strong>{bestHabit.name}</strong>
            <em>
              {bestHabit.current_streak} current · {bestHabit.longest_streak}{' '}
              longest
            </em>
          </article>
        )}
      </div>

      <section className="card trends-analytics__panel">
        <h2>Daily completion</h2>
        <div className="trends-analytics__chart is-tall">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={32} />
              <Tooltip formatter={(v) => [`${v}%`, 'Completion']} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1463F3"
                fill="rgba(20,99,243,0.16)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="trends-analytics__split">
        <section className="card trends-analytics__panel">
          <h2>Weekly averages</h2>
          <div className="trends-analytics__chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                <Bar dataKey="value" fill="#1463F3" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card trends-analytics__panel">
          <h2>Monthly averages</h2>
          <div className="trends-analytics__chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} width={32} />
                <Tooltip formatter={(v) => [`${v}%`, 'Rate']} />
                <Bar dataKey="value" fill="#4f8af5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}

export default TrendsAnalytics
