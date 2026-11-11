import AnalyticsStats from './AnalyticsStats'
import CompletionTrend from './CompletionTrend'
import HabitConsistency from './HabitConsistency'
import CategoryPerformance from './CategoryPerformance'
import TopPerformingHabits from './TopPerformingHabits'
import KeyInsights from './KeyInsights'
import './AnalyticsOverview.css'

function AnalyticsOverview({
  totalHabits,
  comparison,
  streakDays,
  longestStreak,
  range,
  categories,
  topHabits,
  insights,
  dailyTrend,
  onSelectDate,
  overview,
}) {
  return (
    <div className="analytics-overview">
      <AnalyticsStats
        totalHabits={totalHabits}
        completionRate={
          comparison?.current?.rate ??
          overview?.overall_completion_percentage ??
          0
        }
        deltaPoints={comparison?.deltaPoints}
        streakDays={streakDays}
        longestStreak={longestStreak}
      />

      <div className="analytics-overview__mid">
        <CompletionTrend
          dailyTrend={dailyTrend}
          rangeStart={range.start}
          rangeEnd={range.end}
        />
        <HabitConsistency
          initialMonth={range.end}
          onSelectDate={onSelectDate}
        />
      </div>

      <div className="analytics-overview__bottom">
        <CategoryPerformance categories={categories} />
        <TopPerformingHabits habits={topHabits} />
        <KeyInsights insights={insights} />
      </div>
    </div>
  )
}

export default AnalyticsOverview
