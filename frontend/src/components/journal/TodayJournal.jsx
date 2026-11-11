import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import JournalEntryCard from './JournalEntryCard'
import './TodayJournal.css'

function TodayJournal({
  selectedDate,
  entries,
  habits,
  onNewEntry,
  onEdit,
  onDelete,
}) {
  return (
    <section className="today-journal card">
      <div className="today-journal__head">
        <div>
          <h2>Today&apos;s Journal</h2>
          <p>{format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button type="button" className="today-journal__new" onClick={onNewEntry}>
          <Plus size={16} />
          New Entry
        </button>
      </div>

      {!entries.length ? (
        <EmptyState
          title="No journal entries for this day yet."
          description="Start reflecting on your daily progress."
        />
      ) : (
        <div className="today-journal__list">
          {entries.map((entry) => (
            <JournalEntryCard
              key={entry.id}
              entry={entry}
              habits={habits}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default TodayJournal
