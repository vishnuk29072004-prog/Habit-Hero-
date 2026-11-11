import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useProgressTrend } from '../../hooks/useDashboardAnalytics'
import './ProgressTrend.css'

const ranges = ['7D', '30D', '90D']

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="progress-trend__tooltip">
      <span>{label}</span>
      <strong>{payload[0].value}%</strong>
    </div>
  )
}

function ProgressTrend() {
  const [range, setRange] = useState('7D')
  const { points: data } = useProgressTrend(range)

  return (
    <section className="progress-trend card">
      <div className="progress-trend__header">
        <div>
          <h2>Progress Trend</h2>
          <p>Habit completion over time</p>
        </div>
        <div className="progress-trend__filters" role="group" aria-label="Trend range">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              className={range === item ? 'is-active' : ''}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="progress-trend__chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
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
              fill="url(#trendFill)"
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

export default ProgressTrend
