import { Archive, ArchiveRestore, Check, Pencil, Trash2 } from 'lucide-react'
import {
  CATEGORY_BADGE_COLORS,
  getHabitProgress,
} from '../../utils/habitCalculations'
import { getHabitIcon } from './habitIcons'
import './HabitCard.css'

function HabitCard({
  habit,
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
  const Icon = getHabitIcon(habit.icon)
  const completed = Boolean(habit.checkins?.[dateKey]?.completed)
  const progress = getHabitProgress(habit, selectedDate, 30)
  const badge =
    CATEGORY_BADGE_COLORS[habit.category] || CATEGORY_BADGE_COLORS.Health

  return (
    <article className="habit-card">
      <div className="habit-card__top">
        {showArchivedActions ? (
          <span className="habit-card__archived">Archived</span>
        ) : (
          <button
            type="button"
            className={`habit-card__check ${completed ? 'is-done' : ''}`}
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
        <span className="habit-card__icon">
          <Icon size={18} />
        </span>
      </div>

      <h3>{habit.name}</h3>
      {habit.description ? <p className="habit-card__desc">{habit.description}</p> : null}

      <div className="habit-card__meta">
        <span
          className="habit-card__badge"
          style={{ background: badge.bg, color: badge.text }}
        >
          {habit.category}
        </span>
        <span className="habit-card__freq">{habit.frequency}</span>
      </div>

      <div className="habit-card__progress">
        <div className="habit-card__bar">
          <span style={{ width: `${progress.rate}%` }} />
        </div>
        <em>{progress.rate}%</em>
      </div>

      <div className="habit-card__actions">
        {showArchivedActions ? (
          <button type="button" onClick={() => onUnarchive(habit.id)}>
            <ArchiveRestore size={15} />
            Unarchive
          </button>
        ) : (
          <>
            <button type="button" onClick={() => onEdit(habit)}>
              <Pencil size={15} />
              Edit
            </button>
            <button type="button" onClick={() => onArchive(habit.id)}>
              <Archive size={15} />
              Archive
            </button>
          </>
        )}
        <button
          type="button"
          className="is-danger"
          onClick={() => onDelete(habit)}
        >
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    </article>
  )
}

export default HabitCard
