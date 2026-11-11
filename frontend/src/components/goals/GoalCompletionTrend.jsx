import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import EmptyState from '../common/EmptyState'
import './GoalCompletionTrend.css'

function GoalCompletionTrend({ data }) {
  const hasData = data?.some((d) => !d.isFuture)

  return (
    <section className="goal-completion-trend card">
      <div className="goal-completion-trend__head">
        <h2>Completion Trend</h2>
        <p>Goal completion rate over time.</p>
      </div>

      {!hasData ? (
        <EmptyState
          title="Not enough history"
          description="Goal progress over time will appear here as you check in."
        />
      ) : (
        <div className="goal-completion-trend__chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="goalTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1463F3" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#1463F3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#E8EEF8"
                strokeDasharray="4 4"
              />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                width={36}
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [`${value}%`, 'Avg progress']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1463F3"
                strokeWidth={2.5}
                fill="url(#goalTrendFill)"
                dot={{ r: 3, fill: '#1463F3', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default GoalCompletionTrend
