import { useState } from 'react'
import { ChartColumnIncreasing } from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import { resolveDateRange } from '../../utils/analyticsCalculations'
import { useAnalyticsPage } from '../../hooks/useAnalyticsPage'
import PageHeaderTools from '../../components/common/PageHeaderTools'
import DateRangeFilter from '../../components/analytics/DateRangeFilter'
import AnalyticsTabs from '../../components/analytics/AnalyticsTabs'
import AnalyticsOverview from '../../components/analytics/AnalyticsOverview'
import HabitAnalytics from '../../components/analytics/HabitAnalytics'
import CategoryAnalytics from '../../components/analytics/CategoryAnalytics'
import TrendsAnalytics from '../../components/analytics/TrendsAnalytics'
import InsightsAnalytics from '../../components/analytics/InsightsAnalytics'
import EmptyState from '../../components/common/EmptyState'
import './Analytics.css'

function Analytics() {
  const { selectedDate, setSelectedDate, activeHabits } = useHabits()

  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState(() =>
    resolveDateRange('thisMonth', selectedDate || new Date())
  )

  const analytics = useAnalyticsPage(range)

  return (
    <div className="analytics-page">
      <header className="analytics-page__header">
        <div className="analytics-page__title">
          <span className="analytics-page__icon" aria-hidden="true">
            <ChartColumnIncreasing size={26} />
          </span>
          <div>
            <h1>Analytics</h1>
            <p>Track patterns, consistency, and progress across your habits.</p>
          </div>
        </div>

        <div className="analytics-page__tools">
          <DateRangeFilter
            range={range}
            onChange={setRange}
            anchorDate={selectedDate}
          />
          <PageHeaderTools showDate={false} />
        </div>
      </header>

      <AnalyticsTabs active={tab} onChange={setTab} />

      {analytics.error && (
        <div className="analytics-page__banner" role="alert">
          {analytics.error}
        </div>
      )}

      {!activeHabits.length && !analytics.loading ? (
        <EmptyState
          title="No habits to analyze"
          description="Create habits on the Habits page, then check them in to unlock analytics."
        />
      ) : (
        <div
          className="analytics-page__content"
          role="tabpanel"
          aria-busy={analytics.loading || undefined}
        >
          {tab === 'overview' && (
            <AnalyticsOverview
              totalHabits={analytics.totalHabits}
              comparison={analytics.comparison}
              streakDays={analytics.streakDays}
              longestStreak={analytics.longestStreak}
              range={range}
              categories={analytics.categories}
              topHabits={analytics.topHabits}
              insights={analytics.insights}
              dailyTrend={analytics.dailyTrend}
              onSelectDate={setSelectedDate}
              overview={analytics.overview}
              bestDays={analytics.bestDays}
              streaks={analytics.streaks}
            />
          )}
          {tab === 'habits' && (
            <HabitAnalytics habits={activeHabits} range={range} />
          )}
          {tab === 'categories' && (
            <CategoryAnalytics
              categories={analytics.categories}
              habits={activeHabits}
              bestDays={analytics.bestDays}
            />
          )}
          {tab === 'trends' && (
            <TrendsAnalytics
              daily={analytics.dailyTrend}
              weekly={analytics.weeklyTrend}
              monthly={analytics.monthlyTrend}
              period={analytics.period}
              streakDays={analytics.streakDays}
              longestStreak={analytics.longestStreak}
              bestDays={analytics.bestDays}
              streaks={analytics.streaks}
            />
          )}
          {tab === 'insights' && (
            <InsightsAnalytics insights={analytics.insights} />
          )}
        </div>
      )}
    </div>
  )
}

export default Analytics
