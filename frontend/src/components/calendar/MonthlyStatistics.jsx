import {
  CalendarCheck2,
  CalendarX2,
  Flame,
  Percent,
  Trophy,
} from 'lucide-react'
import './MonthlyStatistics.css'

function MonthlyStatistics({ stats }) {
  const rows = [
    {
      id: 'completed',
      label: 'Completed Days',
      value: stats.completedDays,
      icon: CalendarCheck2,
      tone: 'green',
    },
    {
      id: 'missed',
      label: 'Missed Days',
      value: stats.missedDays,
      icon: CalendarX2,
      tone: 'red',
    },
    {
      id: 'rate',
      label: 'Monthly Rate',
      value: `${stats.monthlyRate}%`,
      icon: Percent,
      tone: 'blue',
    },
    {
      id: 'longest',
      label: 'Longest Streak',
      value: `${stats.longestStreak} Days`,
      icon: Trophy,
      tone: 'orange',
    },
    {
      id: 'best',
      label: 'Best Performing Day',
      value: stats.bestPerformingDay,
      icon: Flame,
      tone: 'purple',
    },
  ]

  return (
    <section className="monthly-statistics card">
      <h2>Monthly Statistics</h2>
      <ul>
        {rows.map((row) => {
          const Icon = row.icon
          return (
            <li key={row.id}>
              <span className={`monthly-statistics__icon is-${row.tone}`}>
                <Icon size={16} />
              </span>
              <span className="monthly-statistics__label">{row.label}</span>
              <strong>{row.value}</strong>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default MonthlyStatistics
