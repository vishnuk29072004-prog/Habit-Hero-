import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHabits } from '../../context/HabitContext'
import './HabitProgressTrend.css'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="habit-progress-trend__tooltip">
      <span>{label}</span>
      <strong>{payload[0].value}%</strong>
    </div>
  )
}

function HabitProgressTrend() {
  const { getTrend } = useHabits()
  const data = useMemo(() => getTrend('7D'), [getTrend])

  return (
    <section className="habit-progress-trend card">
      <div className="habit-progress-trend__header">
        <h2>Habit Progress Trend</h2>
        <p>Completion over the last 7 days</p>
      </div>

      <div className="habit-progress-trend__chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="habitMgmtTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1463F3" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#1463F3" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#E2EAF8" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#1463F3"
              strokeWidth={3}
              fill="url(#habitMgmtTrendFill)"
              dot={{ r: 4, fill: '#1463F3', stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default HabitProgressTrend
