import { Archive, ArchiveRestore, Check, Pencil, Trash2 } from 'lucide-react'
import {
  CATEGORY_BADGE_COLORS,
  getHabitProgress,
} from '../../utils/habitCalculations'
import { getHabitIcon } from './habitIcons'
import './HabitTable.css'

function HabitTable({
  habits,
  selectedDate,
  dateKey,
  isFuture,
  onToggle,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  showArchivedActions = false,
}) {
  return (
    <div className="habit-table-wrap">
      <table className="habit-table">
        <thead>
          <tr>
            <th className="habit-table__check-col" aria-label="Complete" />
            <th>Habit</th>
            <th>Category</th>
            <th>Frequency</th>
            <th>Progress</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {habits.map((habit) => {
            const Icon = getHabitIcon(habit.icon)
            const completed = Boolean(habit.checkins?.[dateKey]?.completed)
            const progress = getHabitProgress(habit, selectedDate, 30)
            const badge =
              CATEGORY_BADGE_COLORS[habit.category] ||
              CATEGORY_BADGE_COLORS.Health

            return (
              <tr key={habit.id}>
                <td>
                  {showArchivedActions ? (
                    <span className="habit-table__archived-mark" aria-hidden="true">
                      —
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`habit-table__check ${completed ? 'is-done' : ''}`}
                      onClick={() => onToggle(habit.id)}
                      disabled={isFuture}
                      aria-label={
                        completed
                          ? `Mark ${habit.name} as incomplete`
                          : `Mark ${habit.name} as complete`
                      }
                    >
                      {completed && <Check size={14} strokeWidth={3} />}
                    </button>
                  )}
                </td>
                <td>
                  <div className="habit-table__habit">
                    <span className="habit-table__icon">
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{habit.name}</strong>
                      {habit.description ? <p>{habit.description}</p> : null}
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="habit-table__badge"
                    style={{ background: badge.bg, color: badge.text }}
                  >
                    {habit.category}
                  </span>
                </td>
                <td>{habit.frequency}</td>
                <td>
                  <div className="habit-table__progress">
                    <div className="habit-table__bar">
                      <span style={{ width: `${progress.rate}%` }} />
                    </div>
                    <em>{progress.rate}%</em>
                  </div>
                </td>
                <td>
                  <div className="habit-table__actions">
                    {showArchivedActions ? (
                      <button
                        type="button"
                        onClick={() => onUnarchive(habit.id)}
                        aria-label={`Unarchive ${habit.name}`}
                      >
                        <ArchiveRestore size={15} />
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(habit)}
                          aria-label={`Edit ${habit.name}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onArchive(habit.id)}
                          aria-label={`Archive ${habit.name}`}
                        >
                          <Archive size={15} />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => onDelete(habit)}
                      aria-label={`Delete ${habit.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default HabitTable
