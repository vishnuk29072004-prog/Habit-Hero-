import { format, startOfDay, startOfMonth } from 'date-fns'
import { CheckCircle2, CircleDashed, Percent } from 'lucide-react'
import DailyHabitList from './DailyHabitList'
import DailyNotes from './DailyNotes'
import './DailySummary.css'

function DailySummary({
  selectedDate,
  summary,
  habits,
  isFuture,
  dayNote,
  onSelectToday,
  onToggle,
  onSaveNote,
  loading = false,
}) {
  return (
    <section className="daily-summary card">
      <div className="daily-summary__header">
        <div>
          <h2>{format(selectedDate, 'MMM d, yyyy')}</h2>
          <p>{loading ? 'Loading day…' : 'Daily Habit Summary'}</p>
        </div>
        <button
          type="button"
          className="daily-summary__today"
          onClick={() => {
            const today = startOfDay(new Date())
            onSelectToday(today, startOfMonth(today))
          }}
        >
          Today
        </button>
      </div>

      <div className="daily-summary__kpis">
        <article>
          <CheckCircle2 size={18} className="is-green" />
          <div>
            <strong>{isFuture ? '—' : summary.completed}</strong>
            <span>Completed</span>
          </div>
        </article>
        <article>
          <CircleDashed size={18} className="is-blue" />
          <div>
            <strong>{isFuture ? '—' : summary.pending}</strong>
            <span>{isFuture ? 'Upcoming' : 'Pending'}</span>
          </div>
        </article>
        <article>
          <Percent size={18} className="is-purple" />
          <div>
            <strong>{isFuture ? '—' : `${summary.rate}%`}</strong>
            <span>Completion</span>
          </div>
        </article>
      </div>

      <DailyHabitList
        habits={habits}
        isFuture={isFuture}
        onToggle={onToggle}
      />

      <DailyNotes
        dateKey={format(selectedDate, 'yyyy-MM-dd')}
        note={dayNote}
        onSave={onSaveNote}
        disabled={false}
      />
    </section>
  )
}

export default DailySummary
