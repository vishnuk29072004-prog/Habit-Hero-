import StatCard from '../dashboard/StatCard'
import './HabitStats.css'

function HabitStats({ totalHabits, activeHabits, streakDays, overallCompletion, growth }) {
  return (
    <section className="habit-stats" aria-label="Habit statistics">
      <StatCard
        label="Total Habits"
        value={String(totalHabits)}
        icon="target"
        accent="blue"
      />
      <StatCard
        label="Active Habits"
        value={String(activeHabits)}
        icon="check"
        accent="green"
      />
      <StatCard
        label="Current Streak"
        value={`${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}`}
        icon="flame"
        accent="red"
      />
      <StatCard
        label="Overall Completion"
        value={`${overallCompletion}%`}
        growth={growth}
        icon="chart"
        accent="purple"
      />
    </section>
  )
}

export default HabitStats
