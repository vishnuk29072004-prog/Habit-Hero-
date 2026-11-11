import { useMemo, useState } from 'react'
import { Plus, Target } from 'lucide-react'
import { useHabits } from '../../context/HabitContext'
import { resolveDateRange } from '../../utils/analyticsCalculations'
import {
  filterAndSortApiGoals,
  getGoalStatusTrendFromApi,
} from '../../services/api/goalMappers'
import { toDateKey } from '../../utils/dateUtils'
import PageHeaderTools from '../../components/common/PageHeaderTools'
import DateRangeFilter from '../../components/analytics/DateRangeFilter'
import GoalStats from '../../components/goals/GoalStats'
import GoalProgress from '../../components/goals/GoalProgress'
import GoalCompletionTrend from '../../components/goals/GoalCompletionTrend'
import QuickInsights from '../../components/goals/QuickInsights'
import Achievements from '../../components/goals/Achievements'
import GoalList from '../../components/goals/GoalList'
import GoalForm from '../../components/goals/GoalForm'
import DeleteGoalModal from '../../components/goals/DeleteGoalModal'
import './Goals.css'

function Goals() {
  const {
    activeHabits,
    goals,
    goalsSummary,
    goalsLoading,
    goalsError,
    refreshGoalsAndAchievements,
    streakDays,
    longestStreak,
    selectedDate,
    unlockedAchievements,
    achievementCatalogue,
    achievementSummary,
    addGoal,
    updateGoal,
    deleteGoal,
  } = useHabits()

  const [range, setRange] = useState(() =>
    resolveDateRange('thisMonth', selectedDate || new Date())
  )
  const [tab, setTab] = useState('all')
  const [sort, setSort] = useState('newest')
  const [modalMode, setModalMode] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')

  const summary = goalsSummary || {
    total: 0,
    active: 0,
    completed: 0,
    notStarted: 0,
    overdue: 0,
    completionRate: 0,
  }

  const trend = useMemo(
    () => getGoalStatusTrendFromApi(goals, range.start, range.end),
    [goals, range]
  )

  const filteredGoals = useMemo(
    () => filterAndSortApiGoals(goals, { tab, sort }),
    [goals, tab, sort]
  )

  const counts = useMemo(() => {
    const all = filterAndSortApiGoals(goals, { tab: 'all', sort: 'newest' })
    const active = filterAndSortApiGoals(goals, {
      tab: 'active',
      sort: 'newest',
    })
    const completed = filterAndSortApiGoals(goals, {
      tab: 'completed',
      sort: 'newest',
    })
    return {
      all: all.length,
      active: active.length,
      completed: completed.length,
    }
  }, [goals])

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const openCreate = () => {
    setEditing(null)
    setModalMode('create')
  }

  const openEdit = (goal) => {
    setEditing(goal)
    setModalMode('edit')
  }

  const handleSubmit = async (payload) => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (modalMode === 'edit' && editing) {
        await updateGoal(editing.id, payload)
        showToast('Goal updated')
      } else {
        await addGoal(payload)
        showToast('Goal created')
      }
      setModalMode(null)
      setEditing(null)
    } catch (err) {
      window.alert(err?.message || 'Unable to save goal.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteGoal(deleting.id)
      setDeleting(null)
      showToast('Goal deleted')
    } catch (err) {
      window.alert(err?.message || 'Unable to delete goal.')
    }
  }

  return (
    <div className="goals-page">
      <header className="goals-page__header">
        <div className="goals-page__title">
          <span className="goals-page__icon" aria-hidden="true">
            <Target size={26} />
          </span>
          <div>
            <h1>Goals</h1>
            <p>Set, track, and achieve your personal habit goals.</p>
          </div>
        </div>

        <div className="goals-page__tools">
          <DateRangeFilter
            range={range}
            onChange={setRange}
            anchorDate={selectedDate}
          />
          <PageHeaderTools showDate={false} />
        </div>
      </header>

      {goalsError && (
        <div className="goals-page__banner" role="alert">
          <span>{goalsError}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => refreshGoalsAndAchievements()}
          >
            Retry
          </button>
        </div>
      )}

      <GoalStats
        activeCount={summary.active}
        completedCount={summary.completed}
        streakDays={streakDays}
        longestStreak={longestStreak}
      />

      <div className="goals-page__layout" aria-busy={goalsLoading || undefined}>
        <div className="goals-page__main">
          <div className="goals-page__charts">
            <GoalProgress summary={summary} />
            <GoalCompletionTrend data={trend} />
          </div>

          <GoalList
            goals={filteredGoals}
            tab={tab}
            sort={sort}
            counts={counts}
            onTabChange={setTab}
            onSortChange={setSort}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        </div>

        <aside className="goals-page__aside">
          <button
            type="button"
            className="goals-page__create"
            onClick={openCreate}
          >
            <Plus size={18} />
            Create New Goal
          </button>
          <QuickInsights summary={summary} />
          <Achievements
            unlocked={unlockedAchievements}
            catalogue={achievementCatalogue}
            summary={achievementSummary}
          />
        </aside>
      </div>

      {toast && <div className="goals-page__toast">{toast}</div>}

      {modalMode && (
        <GoalForm
          mode={modalMode}
          goal={editing}
          habits={activeHabits}
          todayKey={toDateKey(selectedDate)}
          submitting={submitting}
          onCancel={() => {
            setModalMode(null)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
        />
      )}

      <DeleteGoalModal
        goal={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default Goals
