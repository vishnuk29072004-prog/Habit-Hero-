import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { JOURNAL_OVERVIEW_PERIODS } from '../../utils/journalCalculations'
import EmptyState from '../common/EmptyState'
import './JournalOverview.css'

function JournalOverview({ overview, period, onPeriodChange }) {
  const data = overview || {
    journaledDays: 0,
    missedDays: 0,
    totalDays: 0,
    rate: 0,
  }
  const chartData = [
    { name: 'Journaled', value: data.journaledDays, color: '#1463F3' },
    { name: 'Missed', value: data.missedDays, color: '#E2EAF8' },
  ].filter((d) => d.value > 0)

  return (
    <section className="journal-overview card">
      <div className="journal-overview__head">
        <h2>Journal Overview</h2>
        <select
          value={period}
          onChange={(e) => onPeriodChange(e.target.value)}
          aria-label="Overview period"
        >
          {JOURNAL_OVERVIEW_PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {!data.totalDays ? (
        <EmptyState
          title="No days in range"
          description="Pick another period to see journaling activity."
        />
      ) : (
        <>
          <div className="journal-overview__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    chartData.length
                      ? chartData
                      : [{ name: 'Empty', value: 1, color: '#E2EAF8' }]
                  }
                  dataKey="value"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={2}
                  stroke="none"
                >
                  {(chartData.length
                    ? chartData
                    : [{ color: '#E2EAF8' }]
                  ).map((entry, index) => (
                    <Cell key={`${entry.name || 'c'}-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="journal-overview__center">
              <strong>{data.rate}%</strong>
              <span>Journal Days</span>
            </div>
          </div>

          <ul className="journal-overview__legend">
            <li>
              <span style={{ background: '#1463F3' }} />
              Journaled Days
              <strong>{data.journaledDays}</strong>
            </li>
            <li>
              <span style={{ background: '#E2EAF8' }} />
              Missed Days
              <strong>{data.missedDays}</strong>
            </li>
            <li>
              <span style={{ background: '#94A3B8' }} />
              Total Days
              <strong>{data.totalDays}</strong>
            </li>
          </ul>
        </>
      )}
    </section>
  )
}

export default JournalOverview
