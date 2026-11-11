import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useHabits } from '../../context/HabitContext'
import { calendarApi } from '../../services/api/calendarApi'
import { mapTrendPoints } from '../../services/api/analyticsMappers'
import { getTrendPresetRange } from '../../utils/analyticsCalculations'
import { toDateKey } from '../../utils/dateUtils'
import EmptyState from '../common/EmptyState'
import './CompletionTrend.css'

const FILTERS = ['7D', '30D', '90D', '1Y']

function CompletionTrend({ dailyTrend, rangeStart, rangeEnd }) {
  const [filter, setFilter] = useState('30D')
  const { calendarTick } = useHabits()
  const [fetched, setFetched] = useState(null)
  const genRef = useRef(0)

  useEffect(() => {
    const generation = ++genRef.current
    const preset = getTrendPresetRange(filter, rangeEnd)
    let start = preset.start < rangeStart ? rangeStart : preset.start
    let end = rangeEnd < preset.end ? rangeEnd : preset.end
    if (start > end) {
      start = rangeStart
      end = rangeEnd
    }
    let cancelled = false
    calendarApi
      .summary({
        start_date: toDateKey(start),
        end_date: toDateKey(end),
      })
      .then((res) => {
        if (cancelled || generation !== genRef.current) return
        setFetched(mapTrendPoints(res?.data?.daily_trend, 'short'))
      })
      .catch(() => {
        if (cancelled || generation !== genRef.current) return
        setFetched([])
      })
    return () => {
      cancelled = true
    }
  }, [filter, rangeStart, rangeEnd, calendarTick])

  const data = useMemo(() => {
    if (fetched) return fetched
    return Array.isArray(dailyTrend) ? dailyTrend : []
  }, [fetched, dailyTrend])

  const hasHistory = data.some((point) => point.scheduled > 0)

  return (
    <section className="completion-trend card">
      <div className="completion-trend__head">
        <div>
          <h2>Completion Trend</h2>
          <p>Daily completion rate over the selected window.</p>
        </div>
        <div className="completion-trend__filters" role="group" aria-label="Trend range">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'is-active' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {!hasHistory ? (
        <EmptyState
          title="Not enough history"
          description="Complete habits over multiple days to unlock trend insights."
        />
      ) : (
        <div className="completion-trend__chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="analyticsTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1463F3" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#1463F3" stopOpacity={0.02} />
                </linearGradient>
              </defs>
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
              />
              <Tooltip
                formatter={(value, _name, props) => [
                  `${value}% (${props.payload.completed}/${props.payload.scheduled})`,
                  'Completion',
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#1463F3"
                strokeWidth={2.5}
                fill="url(#analyticsTrendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default CompletionTrend
