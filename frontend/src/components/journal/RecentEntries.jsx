import { format, parseISO } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import EmptyState from '../common/EmptyState'
import './RecentEntries.css'

function RecentEntries({ recentDates = [], onSelectDate, onViewAll }) {
  const recent = (recentDates || []).slice(0, 3)

  return (
    <section className="recent-entries card">
      <div className="recent-entries__head">
        <h2>Recent Entries</h2>
        <button type="button" onClick={onViewAll}>
          View All
        </button>
      </div>

      {!recent.length ? (
        <EmptyState
          title="No recent entries"
          description="Create journal entries to see them here."
        />
      ) : (
        <ul>
          {recent.map((item) => (
            <li key={item.date}>
              <button type="button" onClick={() => onSelectDate(item.date)}>
                <div>
                  <strong>
                    {format(parseISO(item.date), 'MMM dd, yyyy')}
                  </strong>
                  <span>
                    {item.count} habit{item.count === 1 ? '' : 's'} logged
                  </span>
                </div>
                <ChevronRight size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RecentEntries
