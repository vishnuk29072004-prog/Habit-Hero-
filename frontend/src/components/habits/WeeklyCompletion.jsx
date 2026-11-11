import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHabits } from '../../context/HabitContext'
import './WeeklyCompletion.css'

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="weekly-completion__tooltip">{payload[0].value}%</div>
  )
}

function WeeklyCompletion() {
  const { weeklyProgressData } = useHabits()
  const bestDay = weeklyProgressData.reduce(
    (best, current) => (current.value > best.value ? current : best),
    weeklyProgressData[0] || { day: '', value: 0 }
  )

  return (
    <section className="weekly-completion card">
      <div className="weekly-completion__header">
        <h2>Weekly Completion</h2>
      </div>
      <div className="weekly-completion__chart">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={weeklyProgressData}
            margin={{ top: 18, right: 8, left: -18, bottom: 0 }}
            barCategoryGap="22%"
          >
            <CartesianGrid vertical={false} stroke="#E2EAF8" strokeDasharray="0" />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              cursor={{ fill: 'rgba(20, 99, 243, 0.06)' }}
              content={<CustomTooltip />}
            />
            <Bar dataKey="value" radius={[10, 10, 10, 10]} maxBarSize={42}>
              {weeklyProgressData.map((entry) => (
                <Cell
                  key={entry.day}
                  fill={entry.day === bestDay.day ? '#0B4FCC' : '#1463F3'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

export default WeeklyCompletion
