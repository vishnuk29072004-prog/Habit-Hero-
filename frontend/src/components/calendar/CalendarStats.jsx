import StatCard from '../dashboard/StatCard'
import './CalendarStats.css'

function CalendarStats({
  completedDays,
  monthlyRate,
  streakDays,
  longestStreak,
  growth,
}) {
  return (
    <section className="calendar-stats" aria-label="Calendar statistics">
      <StatCard
        label="Completed Days"
        value={`${completedDays} Days`}
        icon="calendarCheck"
        accent="green"
      />
      <StatCard
        label="Monthly Completion"
        value={`${monthlyRate}%`}
        growth={growth}
        icon="chart"
        accent="blue"
      />
      <StatCard
        label="Current Streak"
        value={`${streakDays} ${streakDays === 1 ? 'Day' : 'Days'}`}
        icon="flame"
        accent="red"
      />
      <StatCard
        label="Longest Streak"
        value={`${longestStreak} ${longestStreak === 1 ? 'Day' : 'Days'}`}
        icon="trophy"
        accent="orange"
      />
    </section>
  )
}

export default CalendarStats
