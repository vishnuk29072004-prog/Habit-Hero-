import WelcomeHeader from '../../components/dashboard/WelcomeHeader'
import StatCard from '../../components/dashboard/StatCard'
import TodayHabits from '../../components/dashboard/TodayHabits'
import WeeklyProgress from '../../components/dashboard/WeeklyProgress'
import HabitCategories from '../../components/dashboard/HabitCategories'
import CurrentStreak from '../../components/dashboard/CurrentStreak'
import MonthlyOverview from '../../components/dashboard/MonthlyOverview'
import ProgressTrend from '../../components/dashboard/ProgressTrend'
import NextGoal from '../../components/dashboard/NextGoal'
import { useDashboardAnalytics } from '../../hooks/useDashboardAnalytics'
import './Dashboard.css'

function Dashboard() {
  const {
    stats,
    weeklyProgressData,
    categoryStats,
    totalCount,
    streakDays,
    loading,
    error,
  } = useDashboardAnalytics()

  return (
    <div className="dashboard">
      <WelcomeHeader />

      {error && (
        <div className="dashboard__banner" role="alert">
          {error}
        </div>
      )}

      <section
        className="dashboard__stats"
        aria-busy={loading || undefined}
      >
        {stats.map((stat) => (
          <StatCard key={stat.id} {...stat} />
        ))}
      </section>

      <section className="dashboard__middle">
        <div className="dashboard__habits">
          <TodayHabits />
        </div>

        <div className="dashboard__charts">
          <WeeklyProgress data={weeklyProgressData} />
          <HabitCategories
            categoryStats={categoryStats}
            totalCount={totalCount}
          />
        </div>

        <div className="dashboard__aside">
          <CurrentStreak streakDays={streakDays} />
          <MonthlyOverview />
        </div>
      </section>

      <section className="dashboard__bottom">
        <div className="dashboard__trend">
          <ProgressTrend />
        </div>
        <div className="dashboard__goal">
          <NextGoal />
        </div>
      </section>
    </div>
  )
}

export default Dashboard
