import StatCard from '../dashboard/StatCard'
import './AnalyticsStats.css'

function AnalyticsStats({
  totalHabits,
  completionRate,
  deltaPoints,
  streakDays,
  longestStreak,
}) {
  return (
    <section className="analytics-stats" aria-label="Analytics summary">
      <StatCard
        label="Total Habits"
        value={totalHabits}
        icon="check"
        accent="blue"
      />
      <StatCard
        label="Completion Rate"
        value={`${completionRate}%`}
        growth={deltaPoints}
        icon="chart"
        accent="green"
      />
      <StatCard
        label="Current Streak"
        value={streakDays}
        icon="flame"
        accent="orange"
      />
      <StatCard
        label="Longest Streak"
        value={longestStreak}
        icon="trophy"
        accent="purple"
      />
    </section>
  )
}

export default AnalyticsStats
