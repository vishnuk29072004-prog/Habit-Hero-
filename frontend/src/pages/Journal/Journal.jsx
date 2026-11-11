import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { parseISO } from 'date-fns'
import { useHabits } from '../../context/HabitContext'
import { getEntriesForDate } from '../../utils/journalCalculations'
import PageHeaderTools from '../../components/common/PageHeaderTools'
import JournalStats from '../../components/journal/JournalStats'
import TodayJournal from '../../components/journal/TodayJournal'
import JournalOverview from '../../components/journal/JournalOverview'
import JournalCalendar from '../../components/journal/JournalCalendar'
import RecentEntries from '../../components/journal/RecentEntries'
import JournalEntryForm from '../../components/journal/JournalEntryForm'
import DeleteJournalModal from '../../components/journal/DeleteJournalModal'
import JournalHistory from '../../components/journal/JournalHistory'
import './Journal.css'

function Journal() {
  const {
    habits,
    activeHabits,
    selectedDate,
    setSelectedDate,
    dateKey,
    journalEntries,
    journalSummary,
    journalLoading,
    journalError,
    refreshJournal,
    refreshJournalSummary,
    searchJournalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,
  } = useHabits()

  const [overviewPeriod, setOverviewPeriod] = useState(
    () => journalSummary?.overview?.period || 'thisMonth'
  )
  const [modalMode, setModalMode] = useState(null)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState('')

  const stats = journalSummary || {
    totalEntries: 0,
    activeDays: 0,
    currentStreak: 0,
    longestStreak: 0,
  }

  const dayEntries = useMemo(
    () => getEntriesForDate(journalEntries, dateKey),
    [journalEntries, dateKey]
  )

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 1800)
  }

  const handlePeriodChange = async (period) => {
    setOverviewPeriod(period)
    try {
      await refreshJournalSummary(period)
    } catch {
      // Error surfaced via journalError banner.
    }
  }

  const openCreate = () => {
    setEditing(null)
    setModalMode('create')
  }

  const openEdit = (entry) => {
    setHistoryOpen(false)
    setEditing(entry)
    setModalMode('edit')
  }

  const handleSubmit = async (payload) => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (modalMode === 'edit' && editing) {
        await updateJournalEntry(editing.id, payload)
        showToast('Entry updated')
      } else {
        await addJournalEntry(payload)
        showToast('Entry saved')
      }
      if (payload.date && payload.date !== dateKey) {
        setSelectedDate(parseISO(payload.date))
      }
      setModalMode(null)
      setEditing(null)
    } catch (err) {
      window.alert(err?.message || 'Unable to save journal entry.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    try {
      await deleteJournalEntry(deleting.id)
      setDeleting(null)
      showToast('Entry deleted')
    } catch (err) {
      window.alert(err?.message || 'Unable to delete journal entry.')
    }
  }

  const selectDateKey = (key) => {
    setSelectedDate(parseISO(key))
  }

  return (
    <div className="journal-page">
      <header className="journal-page__header">
        <div className="journal-page__title">
          <span className="journal-page__icon" aria-hidden="true">
            <BookOpen size={26} />
          </span>
          <div>
            <h1>Journal</h1>
            <p>Reflect, note, and track your habit journey.</p>
          </div>
        </div>
        <PageHeaderTools />
      </header>

      {journalError && (
        <div className="journal-page__banner" role="alert">
          <span>{journalError}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => refreshJournal(overviewPeriod)}
          >
            Retry
          </button>
        </div>
      )}

      <JournalStats
        totalEntries={stats.totalEntries}
        activeDays={stats.activeDays}
        currentStreak={stats.currentStreak}
        longestStreak={stats.longestStreak}
      />

      <div
        className="journal-page__layout"
        aria-busy={journalLoading || undefined}
      >
        <div className="journal-page__main">
          <TodayJournal
            selectedDate={selectedDate}
            entries={dayEntries}
            habits={habits}
            onNewEntry={openCreate}
            onEdit={openEdit}
            onDelete={setDeleting}
          />
        </div>

        <aside className="journal-page__aside">
          <JournalOverview
            overview={journalSummary?.overview}
            period={overviewPeriod}
            onPeriodChange={handlePeriodChange}
          />
          <JournalCalendar
            entries={journalEntries}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <RecentEntries
            recentDates={journalSummary?.recentDates}
            onSelectDate={selectDateKey}
            onViewAll={() => setHistoryOpen(true)}
          />
        </aside>
      </div>

      {toast && <div className="journal-page__toast">{toast}</div>}

      {modalMode && (
        <JournalEntryForm
          mode={modalMode}
          entry={editing}
          habits={activeHabits}
          defaultDate={dateKey}
          submitting={submitting}
          onCancel={() => {
            setModalMode(null)
            setEditing(null)
          }}
          onSubmit={handleSubmit}
        />
      )}

      <DeleteJournalModal
        entry={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <JournalHistory
        open={historyOpen}
        habits={habits}
        searchJournalEntries={searchJournalEntries}
        onClose={() => setHistoryOpen(false)}
        onSelectEntryDate={selectDateKey}
        onEdit={openEdit}
      />
    </div>
  )
}

export default Journal
