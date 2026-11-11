import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { weeklyConsistencyGrowth } from '../../data/mockData'
import { useHabits } from '../../context/HabitContext'
import PageHeaderTools from '../../components/common/PageHeaderTools'
import Modal from '../../components/common/Modal'
import EmptyState from '../../components/common/EmptyState'
import HabitStats from '../../components/habits/HabitStats'
import HabitTabs from '../../components/habits/HabitTabs'
import HabitFilters from '../../components/habits/HabitFilters'
import HabitTable from '../../components/habits/HabitTable'
import HabitCard from '../../components/habits/HabitCard'
import HabitForm, { buildHabitForm } from '../../components/habits/HabitForm'
import DeleteHabitModal from '../../components/habits/DeleteHabitModal'
import WeeklyCompletion from '../../components/habits/WeeklyCompletion'
import FeatureStatus from '../../components/habits/FeatureStatus'
import HabitCategoryDonut from '../../components/habits/HabitCategoryDonut'
import HabitProgressTrend from '../../components/habits/HabitProgressTrend'
import './Habits.css'

function Habits() {
  const {
    habits,
    habitsLoading,
    habitsError,
    refreshHabits,
    dateKey,
    selectedDate,
    isFuture,
    streakDays,
    weeklyConsistency,
    toggleHabit,
    addHabit,
    updateHabit,
    deleteHabit,
    archiveHabit,
    unarchiveHabit,
  } = useHabits()

  const [tab, setTab] = useState('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [frequency, setFrequency] = useState('All')
  const [view, setView] = useState('list')
  const [modalMode, setModalMode] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const nonArchived = useMemo(
    () => habits.filter((habit) => !habit.archived),
    [habits]
  )
  const archived = useMemo(
    () => habits.filter((habit) => habit.archived),
    [habits]
  )
  const completedToday = useMemo(
    () =>
      nonArchived.filter((habit) => habit.checkins?.[dateKey]?.completed),
    [nonArchived, dateKey]
  )
  const activeToday = useMemo(
    () =>
      nonArchived.filter((habit) => !habit.checkins?.[dateKey]?.completed),
    [nonArchived, dateKey]
  )

  const counts = {
    all: nonArchived.length,
    active: activeToday.length,
    completed: completedToday.length,
    archived: archived.length,
  }

  const tabHabits = useMemo(() => {
    if (tab === 'archived') return archived
    if (tab === 'completed') return completedToday
    if (tab === 'active') return activeToday
    return nonArchived
  }, [tab, archived, completedToday, activeToday, nonArchived])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tabHabits.filter((habit) => {
      const matchesQuery =
        !q ||
        habit.name.toLowerCase().includes(q) ||
        habit.description?.toLowerCase().includes(q)
      const matchesCategory = category === 'All' || habit.category === category
      const matchesFrequency =
        frequency === 'All' || habit.frequency === frequency
      return matchesQuery && matchesCategory && matchesFrequency
    })
  }, [tabHabits, query, category, frequency])

  const openCreate = () => {
    setEditing(null)
    setModalMode('create')
  }

  const openEdit = (habit) => {
    setEditing(habit)
    setModalMode('edit')
  }

  const closeForm = () => {
    setModalMode(null)
    setEditing(null)
  }

  const handleFormSubmit = async (payload) => {
    if (modalMode === 'create') {
      await addHabit(payload)
      return
    }
    if (editing) {
      await updateHabit(editing.id, {
        name: payload.name,
        description: payload.description,
        category: payload.category,
        frequency: payload.frequency,
        startDate: payload.startDate,
        notes: payload.notes,
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteHabit(deleting.id)
      setDeleting(null)
    } catch (err) {
      window.alert(err?.message || 'Unable to delete habit.')
    }
  }

  const handleArchive = async (id) => {
    try {
      await archiveHabit(id)
    } catch (err) {
      window.alert(err?.message || 'Unable to archive habit.')
    }
  }

  const handleUnarchive = async (id) => {
    try {
      await unarchiveHabit(id)
    } catch (err) {
      window.alert(err?.message || 'Unable to restore habit.')
    }
  }

  const showArchivedActions = tab === 'archived'

  return (
    <div className="habits-page">
      <header className="habits-page__header">
        <div>
          <h1>Habit Management</h1>
          <p>Create, track, edit, and organize all your habits in one place.</p>
        </div>
        <PageHeaderTools />
      </header>

      <HabitStats
        totalHabits={counts.all}
        activeHabits={counts.active}
        streakDays={streakDays}
        overallCompletion={weeklyConsistency}
        growth={weeklyConsistencyGrowth}
      />

      <div className="habits-page__mid">
        <section className="habits-page__main card">
          <div className="habits-page__main-top">
            <HabitTabs activeTab={tab} counts={counts} onChange={setTab} />
            <button type="button" className="btn-primary" onClick={openCreate}>
              <Plus size={16} />
              Add Habit
            </button>
          </div>

          <HabitFilters
            query={query}
            category={category}
            frequency={frequency}
            view={view}
            onQueryChange={setQuery}
            onCategoryChange={setCategory}
            onFrequencyChange={setFrequency}
            onViewChange={setView}
          />

          {habitsError && (
            <div className="habits-page__banner habits-page__banner--error" role="alert">
              <span>{habitsError}</span>
              <button type="button" className="btn-secondary" onClick={() => refreshHabits()}>
                Retry
              </button>
            </div>
          )}

          {habitsLoading ? (
            <EmptyState
              title="Loading habits"
              description="Fetching your habits from the server…"
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No habits found"
              description="Try a different filter or create a new habit."
            />
          ) : view === 'list' ? (
            <HabitTable
              habits={filtered}
              selectedDate={selectedDate}
              dateKey={dateKey}
              isFuture={isFuture}
              onToggle={toggleHabit}
              onEdit={openEdit}
              onDelete={setDeleting}
              onArchive={handleArchive}
              onUnarchive={handleUnarchive}
              showArchivedActions={showArchivedActions}
            />
          ) : (
            <div className="habits-page__grid">
              {filtered.map((habit) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  selectedDate={selectedDate}
                  dateKey={dateKey}
                  isFuture={isFuture}
                  onToggle={toggleHabit}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                  onArchive={handleArchive}
                  onUnarchive={handleUnarchive}
                  showArchivedActions={showArchivedActions}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="habits-page__aside">
          <WeeklyCompletion />
          <FeatureStatus />
        </aside>
      </div>

      <div className="habits-page__bottom">
        <HabitCategoryDonut />
        <HabitProgressTrend />
      </div>

      {(modalMode === 'create' || modalMode === 'edit') && (
        <Modal
          title={modalMode === 'create' ? 'Add Habit' : 'Edit Habit'}
          onClose={closeForm}
        >
          <HabitForm
            key={modalMode === 'edit' ? editing?.id : 'create'}
            mode={modalMode}
            initialValues={buildHabitForm(editing, dateKey)}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
          />
        </Modal>
      )}

      <DeleteHabitModal
        habit={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

export default Habits
