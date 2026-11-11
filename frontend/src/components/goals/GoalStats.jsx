import StatCard from '../dashboard/StatCard'
import './GoalStats.css'

function GoalStats({ activeCount, completedCount, streakDays, longestStreak }) {
  return (
    <section className="goal-stats" aria-label="Goals summary">
      <StatCard
        label="Active Goals"
        value={activeCount}
        icon="target"
        accent="blue"
      />
      <StatCard
        label="Completed Goals"
        value={completedCount}
        icon="check"
        accent="green"
      />
      <StatCard
        label="Current Streak"
        value={`${streakDays} Days`}
        icon="flame"
        accent="orange"
      />
      <StatCard
        label="Longest Streak"
        value={`${longestStreak} Days`}
        icon="trophy"
        accent="purple"
      />
    </section>
  )
}

export default GoalStats
