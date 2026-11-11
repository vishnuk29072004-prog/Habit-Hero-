import StatCard from '../dashboard/StatCard'
import './JournalStats.css'

function JournalStats({ totalEntries, activeDays, currentStreak, longestStreak }) {
  return (
    <section className="journal-stats" aria-label="Journal summary">
      <StatCard
        label="Total Entries"
        value={totalEntries}
        icon="notebook"
        accent="blue"
      />
      <StatCard
        label="Active Days"
        value={activeDays}
        icon="calendarCheck"
        accent="green"
      />
      <StatCard
        label="Current Streak"
        value={`${currentStreak} Days`}
        icon="flame"
        accent="red"
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

export default JournalStats
